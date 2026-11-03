/// 用量计量：包在 provider 外层，任何完成的调用都会被记下。
///
/// 放在 Agent Loop 之外，因此超时 / 取消 / 抛异常时用量也不会丢——
/// loop 内部的累计器会随 `AgentTurn` 一起被丢弃。
library;

import 'package:conatus/conatus.dart';

/// 累计每次成功调用返回的 token 用量。
class UsageMeter implements LlmProvider {
  UsageMeter(this.inner);

  /// 被装饰的 provider。
  final LlmProvider inner;

  /// 已完成的调用累计用量。
  TokenUsage total = TokenUsage.zero;

  @override
  String get name => inner.name;

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async {
    final LlmResult result = await inner.chat(
      messages,
      options: options,
      tools: tools,
    );
    total = total + TokenUsage.parse(result.usage);
    return result;
  }

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => inner.chatStream(messages, options: options, tools: tools);

  @override
  void close() => inner.close();
}
