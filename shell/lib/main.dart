import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/conatus_work.dart';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
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
    final String home = Platform.environment['HOME'] ?? '.';
    final ConfigStore configStore = ConfigStore(
      path: '$home/.conatus-work/config.json',
    );
    final Map<String, String> env = mergeEnv(
      Platform.environment,
      configStore.load(),
      envFile: parseEnvFile('$home/.conatus_work_env'),
    );
    final List<String> roots = candidateRoots(
      cwd: Directory.current.path,
      executable: Platform.resolvedExecutable,
    );
    final String? uiUrl = _env('CONATUS_WORK_UI_URL');
    final String? uiDir =
        _env('CONATUS_WORK_UI') ??
        findBundledUiDir(Platform.resolvedExecutable) ??
        findUiDir(roots);
    if (uiUrl == null && uiDir == null) {
      if (!mounted) return;
      setState(
        () => _error =
            '找不到前端构建产物（ui/dist/index.html），也没有设置 CONATUS_WORK_UI_URL。\n'
            '已尝试：\n${roots.join('\n')}',
      );
      return;
    }
    final String? foundTasksDir = findTasksDir(roots);
    final String appRoot = uiDir != null
        ? Directory(uiDir).parent.parent.path
        : foundTasksDir != null
        ? Directory(foundTasksDir).parent.path
        : Directory.current.path;
    final String? dataDir =
        _env('CONATUS_WORK_DATA') ??
        (findBundledResource(Platform.resolvedExecutable, 'ui') != null
            ? userDataDir(Platform.environment['HOME'] ?? '.', 'Conatus Work')
            : null);
    final String fallbackRoot = dataDir ?? '$appRoot/var';
    final String runsDir =
        _env('CONATUS_WORK_RUNS') ?? findRunsDir(roots) ?? '$fallbackRoot/runs';
    Directory(runsDir).createSync(recursive: true);
    final String tasksDir =
        _env('CONATUS_WORK_TASKS') ??
        findBundledResource(Platform.resolvedExecutable, 'tasks') ??
        foundTasksDir ??
        '${dataDir ?? appRoot}/tasks';
    final String modelLabel = env['WORK_LLM_MODEL'] ?? '(未配置)';
    debugPrint(
      'conatus shell: ui=${uiUrl ?? uiDir} runs=$runsDir tasks=$tasksDir model=$modelLabel',
    );
    try {
      AssetServer? server;
      if (uiUrl == null) {
        server = AssetServer(root: Directory(uiDir!));
        await server.start();
      }
      final Uri url = uiUrl != null ? Uri.parse(uiUrl) : server!.uri!;
      late final WebViewController controller;
      controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setOnConsoleMessage(
          (JavaScriptConsoleMessage message) =>
              debugPrint('console ${message.level.name}: ${message.message}'),
        )
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (String url) => debugPrint('page started: $url'),
            onPageFinished: (String url) =>
                unawaited(_inspect(controller, url)),
            onHttpError: (HttpResponseError error) => debugPrint(
              'http error ${error.response?.statusCode} ${error.request?.uri}',
            ),
            onWebResourceError: (WebResourceError error) => debugPrint(
              'resource error ${error.errorCode} ${error.description} ${error.url}',
            ),
          ),
        );
      void push(String json) => unawaited(
        controller.runJavaScript(
          'window.__conatusReceive(${jsonEncode(json)});',
        ),
      );
      final ShellChannel channel = ShellChannel(
        host: BridgeHost(
          bridge: WorkbenchBridge(runsDir: runsDir),
          tasks: TaskService(
            runsDir: runsDir,
            tasksDir: tasksDir,
            env: env,
            workspacesDir: '$fallbackRoot/workspaces',
          ),
          configStore: configStore,
          push: push,
          chooseWorkspace: () => getDirectoryPath(confirmButtonText: '选择工作区'),
          revealArtifact: (String path) async {
            await Process.run('open', <String>['-R', path]);
          },
        ),
        post: push,
      );
      await controller.addJavaScriptChannel(
        'conatus',
        onMessageReceived: (JavaScriptMessage message) =>
            unawaited(channel.receive(message.message)),
      );
      await controller.loadRequest(url);
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

  Future<void> _inspect(WebViewController controller, String url) async {
    debugPrint('page finished: $url');
    try {
      final Object report = await controller.runJavaScriptReturningResult(
        'JSON.stringify({root: (document.getElementById("root") || {innerHTML: ""}).innerHTML.length, '
        'errors: window.__errors || []})',
      );
      debugPrint('page report: $report');
      if (kDebugMode) {
        // 前端首屏要等一个 fixture 动态 import，页完成时还是空壳；延迟复查一次。
        await Future<void>.delayed(const Duration(seconds: 3));
        final Object mounted = await controller.runJavaScriptReturningResult(
          'JSON.stringify({root: document.getElementById("root").innerHTML.length, '
          'tasks: document.querySelectorAll("[data-testid=\\"task-list\\"] button").length, '
          'errors: window.__errors || []})',
        );
        debugPrint('page settled: $mounted');
      }
    } on Object catch (error) {
      debugPrint('inspect failed: $error');
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
          const Text(
            '先在 ui/ 下跑 npm run build，或设置 CONATUS_WORK_UI_URL=http://127.0.0.1:5173 加载 Vite 开发服务器。',
          ),
        ],
      ),
    );
  }
}

String? _env(String name) {
  final String? value = Platform.environment[name];
  return value == null || value.isEmpty ? null : value;
}
