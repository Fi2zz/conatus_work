import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/conatus_work.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'asset_server.dart';
import 'channel.dart';
import 'paths.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ShellApp());
}

/// 桌面壳：起一个受控资源服务，把它加载进 WebView，并把消息通道接到桥接层。
class ShellApp extends StatefulWidget {
  const ShellApp({super.key});

  @override
  State<ShellApp> createState() => _ShellAppState();
}

class _ShellAppState extends State<ShellApp> {
  AssetServer? _server;
  WebViewController? _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  @override
  void dispose() {
    unawaited(_server?.stop());
    super.dispose();
  }

  Future<void> _boot() async {
    final List<String> roots = candidateRoots(
      cwd: Directory.current.path,
      executable: Platform.resolvedExecutable,
    );
    final String? uiDir =
        _env('CONATUS_WORK_UI') ?? findUiDir(roots);
    if (uiDir == null) {
      if (!mounted) return;
      setState(
        () => _error =
            '找不到前端构建产物（ui/dist/index.html）。已尝试：\n${roots.join('\n')}',
      );
      return;
    }
    final String runsDir =
        _env('CONATUS_WORK_RUNS') ??
        findRunsDir(roots) ??
        '${Directory(uiDir).parent.parent.path}/var/runs';
    debugPrint('conatus shell: ui=$uiDir runs=$runsDir');
    try {
      final AssetServer server = AssetServer(root: Directory(uiDir));
      await server.start();
      final WebViewController controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted);
      final ShellChannel channel = ShellChannel(
        host: BridgeHost(bridge: WorkbenchBridge(runsDir: runsDir)),
        post: (String json) => unawaited(
          controller.runJavaScript('window.__conatusReceive(${jsonEncode(json)});'),
        ),
      );
      await controller.addJavaScriptChannel(
        'conatus',
        onMessageReceived: (JavaScriptMessage message) =>
            unawaited(channel.receive(message.message)),
      );
      await controller.loadRequest(server.uri!);
      if (!mounted) return;
      setState(() {
        _server = server;
        _controller = controller;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _error = '$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final WebViewController? controller = _controller;
    if (_error != null) {
      return MaterialApp(
        home: Scaffold(body: _StartupError(message: _error!)),
      );
    }
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: controller == null
            ? const Center(child: CircularProgressIndicator())
            : WebViewWidget(controller: controller),
      ),
    );
  }
}

class _StartupError extends StatelessWidget {
  const _StartupError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          const Text('工作台启动失败', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 8),
          SelectableText(message),
          const SizedBox(height: 12),
          const Text('先在 ui/ 下跑 npm run build，并用 CONATUS_WORK_UI / CONATUS_WORK_RUNS 指定路径。'),
        ],
      ),
    );
  }
}

String? _env(String name) {
  final String? value = Platform.environment[name];
  return value == null || value.isEmpty ? null : value;
}
