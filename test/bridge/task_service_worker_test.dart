import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/task_service.dart';
import 'package:conatus_work/src/bridge/worker_launcher.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/worker_job.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson(String workspace) => <String, Object?>{
  'id': 'worker-v01',
  'chain': 'organize',
  'title': 'worker 任务',
  'workspace': <String, Object?>{
    'root': workspace,
    'read': <String>['inbox'],
    'write': <String>['inbox', 'out'],
  },
  'inputs': <String>['inbox/a.txt'],
  'prompt': '空跑',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
};

class _ControlledProcess implements WorkerProcess {
  final Completer<int> _done = Completer<int>();

  @override
  Future<int> get exitCode => _done.future;

  @override
  int get pid => 424242;

  @override
  bool kill() {
    if (!_done.isCompleted) _done.complete(137);
    return true;
  }

  @override
  bool terminate() {
    if (!_done.isCompleted) _done.complete(143);
    return true;
  }

  void finish() {
    if (!_done.isCompleted) _done.complete(0);
  }
}

class _InstantProcess implements WorkerProcess {
  _InstantProcess(this.exitCode);

  @override
  final Future<int> exitCode;

  @override
  int get pid => 424242;

  @override
  bool kill() => true;

  @override
  bool terminate() => true;
}

class _RequestLauncher extends WorkerLauncher {
  _RequestLauncher(this.process) : super(executable: 'fake-worker');

  final _ControlledProcess process;

  @override
  Future<WorkerProcess> start(
    WorkerJob job, {
    required String jobPath,
    required Map<String, String> env,
  }) async {
    await job.write(jobPath);
    final RunPaths paths = RunPaths(runsDir: job.runsDir, runId: job.runId);
    final Directory requests = Directory('${paths.runDir}/approvals/requests')
      ..createSync(recursive: true);
    File('${requests.path}/req-1.json').writeAsStringSync(
      jsonEncode(<String, Object?>{
        'id': 'req-1',
        'toolName': 'apply_patch',
        'arguments': <String, Object?>{'patch': 'x'},
      }),
    );
    unawaited(() async {
      final File response = File(
        '${paths.runDir}/approvals/responses/req-1.json',
      );
      while (!response.existsSync()) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      await _writeSucceededRecord(job);
      process.finish();
    }());
    return process;
  }
}

class _FakeLauncher extends WorkerLauncher {
  _FakeLauncher(this.onStart) : super(executable: 'fake-worker');

  final Future<void> Function(WorkerJob job, String jobPath) onStart;

  @override
  Future<WorkerProcess> start(
    WorkerJob job, {
    required String jobPath,
    required Map<String, String> env,
  }) async {
    await job.write(jobPath);
    await onStart(job, jobPath);
    return _InstantProcess(Future<int>.value(0));
  }
}

void main() {
  late Directory tmp;
  late String tasksDir;
  late String workspace;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('worker_service_');
    tasksDir = '${tmp.path}/tasks';
    workspace = '${tmp.path}/work';
    Directory(tasksDir).createSync();
    Directory('$workspace/inbox').createSync(recursive: true);
    File('$workspace/inbox/a.txt').writeAsStringSync('a');
    File(
      '$tasksDir/worker-v01.json',
    ).writeAsStringSync(jsonEncode(cardJson(workspace)));
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  test('worker 审批请求经文件往返后收尾', () async {
    final _ControlledProcess process = _ControlledProcess();
    final WorkerLauncher launcher = _RequestLauncher(process);
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService service = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      workerLauncher: launcher,
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
      },
    );
    await service.start(
      cardId: 'worker-v01',
      workspaceRoot: workspace,
      onEvent: events.add,
    );
    final bool requested = await _waitFor(
      () => events.any(
        (Map<String, Object?> e) => e['type'] == 'approval/requested',
      ),
    );
    expect(requested, isTrue);
    final Map<String, Object?> request =
        events.firstWhere(
              (Map<String, Object?> e) => e['type'] == 'approval/requested',
            )['data']!
            as Map<String, Object?>;
    await service.respondApproval(request['requestId']! as String, 'allow');
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final Map<String, Object?> resolved =
        events.firstWhere(
              (Map<String, Object?> e) => e['type'] == 'approval/resolved',
            )['data']!
            as Map<String, Object?>;
    expect(resolved['decision'], 'allow');
    expect(process.exitCode, completes);
  });

  test('worker launcher 启动后按 run.json 收尾', () async {
    final _FakeLauncher launcher = _FakeLauncher((
      WorkerJob job,
      String jobPath,
    ) async {
      final RunPaths paths = RunPaths(runsDir: job.runsDir, runId: job.runId);
      await paths.create();
      final RunRecord record =
          RunRecord(
              runId: job.runId,
              taskId: 'worker-v01',
              chain: 'organize',
              taskPath: job.cardPath,
              workspaceRoot: job.workspaceRoot,
              sessionId: 'events',
              pid: 424242,
              startedAt: DateTime.now(),
            )
            ..status = TaskRunStatus.succeeded
            ..endedAt = DateTime.now()
            ..startTurn = 0
            ..endTurn = 1
            ..checkpointStatus = CheckpointStatus.ok
            ..model = 'fake';
      await RunStore(paths).save(record);
    });
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService service = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      workerLauncher: launcher,
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
      },
    );
    final String runId = await service.start(
      cardId: 'worker-v01',
      workspaceRoot: workspace,
      onEvent: events.add,
    );
    final bool finished = await _waitFor(
      () => events.any(
        (Map<String, Object?> e) =>
            e['type'] == 'task/ended' &&
            (e['data']! as Map<String, Object?>)['status'] == 'succeeded',
      ),
    );
    expect(finished, isTrue, reason: 'runId=$runId events=$events');
  });
}

Future<void> _writeSucceededRecord(WorkerJob job) async {
  final RunPaths paths = RunPaths(runsDir: job.runsDir, runId: job.runId);
  await paths.create();
  final RunRecord record =
      RunRecord(
          runId: job.runId,
          taskId: 'worker-v01',
          chain: 'organize',
          taskPath: job.cardPath,
          workspaceRoot: job.workspaceRoot,
          sessionId: 'events',
          pid: 424242,
          startedAt: DateTime.now(),
        )
        ..status = TaskRunStatus.succeeded
        ..endedAt = DateTime.now()
        ..startTurn = 0
        ..endTurn = 1
        ..checkpointStatus = CheckpointStatus.ok
        ..model = 'fake';
  await RunStore(paths).save(record);
}

Future<bool> _waitFor(bool Function() condition) async {
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 10));
  while (DateTime.now().isBefore(deadline)) {
    if (condition()) return true;
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
  return condition();
}
