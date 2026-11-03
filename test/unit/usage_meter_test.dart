import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/usage_meter.dart';
import 'package:test/test.dart';

class FakeLlm implements LlmProvider {
  FakeLlm(this.usage);
  final Map<String, dynamic> usage;

  @override
  String get name => 'fake';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async =>
      LlmResult(content: 'x', provider: 'fake', model: 'fake', usage: usage);

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => const Stream<LlmStreamEvent>.empty();

  @override
  void close() {}
}

void main() {
  test('多次调用的用量累加', () async {
    final UsageMeter meter = UsageMeter(
      FakeLlm(<String, dynamic>{'prompt_tokens': 10, 'completion_tokens': 5}),
    );
    await meter.chat(<LlmMessage>[const LlmMessage('user', 'hi')]);
    await meter.chat(<LlmMessage>[const LlmMessage('user', 'hi')]);
    expect(meter.total.prompt, 20);
    expect(meter.total.completion, 10);
  });

  test('调用失败不计入（只记完成的调用）', () async {
    final UsageMeter meter = UsageMeter(_ThrowingLlm());
    await expectLater(
      meter.chat(<LlmMessage>[const LlmMessage('user', 'hi')]),
      throwsA(isA<LlmException>()),
    );
    expect(meter.total.prompt, 0);
  });
}

class _ThrowingLlm implements LlmProvider {
  @override
  String get name => 'boom';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async => throw const LlmException('boom', 'failed');

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => const Stream<LlmStreamEvent>.empty();

  @override
  void close() {}
}
