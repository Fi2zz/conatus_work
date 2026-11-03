import 'dart:io';
import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/agent_task_body.dart';
import 'package:conatus_work/src/runner/llm_config.dart';
import 'package:conatus_work/src/runner/llm_runtime.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:test/test.dart';

/// 按预设序列回放的模型：不联网、不花钱。
class ScriptedLlm implements LlmProvider {
  ScriptedLlm(this.responses);

  final List<LlmResult> responses;
  int calls = 0;
  String lastUserText = '';

  @override
  String get name => 'scripted';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async {
    lastUserText = messages
        .where((LlmMessage m) => m.role == 'user')
        .map((LlmMessage m) => m.content)
        .join('\n');
    final LlmResult response =
        responses[calls < responses.length ? calls : responses.length - 1];
    calls += 1;
    return response;
  }

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => const Stream<LlmStreamEvent>.empty();

  @override
  void close() {}
}

/// 第一次正常，之后抛错。
class FailAfterFirst implements LlmProvider {
  FailAfterFirst(this.inner);

  final LlmProvider inner;
  int calls = 0;

  @override
  String get name => 'fail-after-first';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) {
    calls += 1;
    if (calls > 1) throw const LlmException('fake', 'boom');
    return inner.chat(messages, options: options, tools: tools);
  }

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => const Stream<LlmStreamEvent>.empty();

  @override
  void close() {}
}

/// 慢模型：用于触发超时。
class SlowLlm implements LlmProvider {
  SlowLlm(this.delay);

  final Duration delay;

  @override
  String get name => 'slow';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async {
    await Future<void>.delayed(delay);
    return const LlmResult(content: 'late', provider: 'slow', model: 'slow');
  }

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => const Stream<LlmStreamEvent>.empty();

  @override
  void close() {}
}

LlmResult writeReport() => LlmResult(
  content: '',
  provider: 'scripted',
  model: 'scripted',
  usage: <String, dynamic>{'prompt_tokens': 10, 'completion_tokens': 5},
  toolCalls: <LlmToolCall>[
    LlmToolCall(
      id: 'call-1',
      name: 'write',
      arguments: '{"path":"out/report.md","content":"${'结论' * 20}"}',
    ),
  ],
);

LlmResult finish() => const LlmResult(
  content: '完成',
  provider: 'scripted',
  model: 'scripted',
  usage: <String, dynamic>{'prompt_tokens': 10, 'completion_tokens': 5},
);

TaskSpec card({double maxCostUsd = 5, int? maxSeconds}) =>
    TaskSpec.parse(<String, Object?>{
      'id': 'agent-v01',
      'chain': 'research',
      'title': '模型任务',
      'workspace': <String, Object?>{
        'root': 'work',
        'read': <String>[],
        'write': <String>['out'],
      },
      'inputs': <String>[],
      'prompt': '写一份报告到 out/report.md',
      'network': 'deny',
      'expectedArtifacts': <String>['out/report.md'],
      'artifactRules': <String, Object?>{
        'out/report.md': <String, Object?>{'minChars': 10},
      },
      'acceptance': <String>[],
      'limits': <String, Object?>{
        'maxMinutes': 5,
        'maxCostUsd': maxCostUsd,
        if (maxSeconds != null) 'maxSeconds': maxSeconds,
      },
      'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
    });

void main() {
  late Directory tmp;
  setUp(() => tmp = Directory.systemTemp.createTempSync('agent_'));
  tearDown(() => tmp.deleteSync(recursive: true));

  test('脚本化模型调用工具写出产物，usage 回填', () async {
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: '${tmp.path}/runs',
      llm: LlmRuntime(
        config: const LlmConfig(baseUrl: 'http://fake', model: 'fake'),
        provider: ScriptedLlm(<LlmResult>[writeReport(), finish()]),
      ),
    );
    final RunRecord record = await runner.run(
      RunRequest(
        task: card(),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    expect(record.status, TaskRunStatus.succeeded);
    expect(record.artifacts.single.passed, isTrue);
    expect(record.inputTokens, 20);
    expect(record.outputTokens, 10);
    expect(record.model, 'openai-compatible/fake');
    expect(File('${tmp.path}/work/out/report.md').existsSync(), isTrue);
  });

  test('abort.request 能中断进行中的模型调用', () async {
    final String runs = '${tmp.path}/runs';
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: runs,
      llm: LlmRuntime(
        config: const LlmConfig(baseUrl: 'http://fake', model: 'fake'),
        provider: SlowLlm(const Duration(seconds: 5)),
      ),
    );
    final Future<RunRecord> running = runner.run(
      RunRequest(
        task: card(),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
      runId: 'run-abort-1',
    );
    await Future<void>.delayed(const Duration(milliseconds: 300));
    File('$runs/run-abort-1/abort.request').writeAsStringSync('');
    final RunRecord record = await running;
    expect(record.status, TaskRunStatus.aborted);
  });

  test('成本超限 → failed/budget', () async {
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: '${tmp.path}/runs',
      llm: LlmRuntime(
        config: const LlmConfig(
          baseUrl: 'http://fake',
          model: 'fake',
          priceInput: 1,
          priceOutput: 1,
        ),
        provider: ScriptedLlm(<LlmResult>[
          const LlmResult(
            content: 'done',
            provider: 'scripted',
            model: 'scripted',
            usage: <String, dynamic>{
              'prompt_tokens': 1000000,
              'completion_tokens': 0,
            },
          ),
        ]),
      ),
    );
    final RunRecord record = await runner.run(
      RunRequest(
        task: card(maxCostUsd: 0.1),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.budget);
  });

  test('未装配模型 → failed/llm', () async {
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: '${tmp.path}/runs',
    );
    final RunRecord record = await runner.run(
      RunRequest(
        task: card(),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.llm);
  });

  test('RunPaths 仍可用（防 import 漂移）', () async {
    final RunPaths paths = RunPaths(
      runsDir: '${tmp.path}/runs',
      runId: 'run_x',
    );
    await paths.create();
    expect(Directory(paths.runDir).existsSync(), isTrue);
  });

  test('confirmed 时把 --yes 写进用户回合', () async {
    final ScriptedLlm llm = ScriptedLlm(<LlmResult>[
      const LlmResult(content: 'done', provider: 's', model: 's'),
    ]);
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: '${tmp.path}/runs',
      llm: LlmRuntime(
        config: const LlmConfig(baseUrl: 'http://fake', model: 'fake'),
        provider: llm,
      ),
    );
    await runner.run(
      RunRequest(
        task: card(),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
        confirmed: true,
      ),
    );
    expect(llm.lastUserText, contains('--yes'));
    expect(llm.lastUserText, contains('已确认'));
  });

  test('模型中途抛错时，已完成的调用用量仍被记录', () async {
    final LlmProvider failing = FailAfterFirst(
      ScriptedLlm(<LlmResult>[writeReport(), finish()]),
    );
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: '${tmp.path}/runs',
      llm: LlmRuntime(
        config: const LlmConfig(baseUrl: 'http://fake', model: 'fake'),
        provider: failing,
      ),
    );
    final RunRecord record = await runner.run(
      RunRequest(
        task: card(),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.llm);
    expect(record.inputTokens, 10);
    expect(record.outputTokens, 5);
  });

  test('超时：慢模型触发 timeout', () async {
    final Runner runner = Runner(
      body: agentTaskBody,
      runsDir: '${tmp.path}/runs',
      llm: LlmRuntime(
        config: const LlmConfig(baseUrl: 'http://fake', model: 'fake'),
        provider: SlowLlm(const Duration(seconds: 5)),
      ),
    );
    final RunRecord record = await runner.run(
      RunRequest(
        task: card(maxSeconds: 1),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.timeout);
  });
}
