import 'package:conatus_work/conatus_work.dart';

/// WebView 与 [BridgeHost] 之间的接线：一条入站帧进，若干出站帧交给前端。
class ShellChannel {
  ShellChannel({required this.host, required this.post});

  /// 协议分发器。
  final BridgeHost host;

  /// 把 JSON 帧送回 WebView（实现通常是 `window.__conatusReceive(...)`）。
  final void Function(String json) post;

  /// 处理一条来自前端的消息；返回本次写入的帧数，便于测试断言。
  Future<int> receive(String raw) async {
    final List<String> frames = await host.dispatch(raw);
    for (final String frame in frames) {
      post(frame);
    }
    return frames.length;
  }
}
