import 'dart:io';

import 'package:conatus_work/src/bridge/worker_launcher.dart';
import 'package:conatus_work/src/runner/worker_job.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('launcher_');
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  WorkerJob job() => WorkerJob(
    runsDir: '${tmp.path}/runs',
    runId: 'run_1',
    cardPath: '${tmp.path}/card.json',
    workspaceRoot: '${tmp.path}/work',
  );

  test('start 写作业文件并等待进程退出', () async {
    final WorkerLauncher launcher = WorkerLauncher(
      executable: 'sh',
      prefixArgs: <String>['-c', 'exit 0'],
    );
    final String jobPath = '${tmp.path}/job.json';
    final WorkerProcess process = await launcher.start(
      job(),
      jobPath: jobPath,
      env: <String, String>{},
    );
    expect(File(jobPath).existsSync(), isTrue);
    expect(await process.exitCode, 0);
  });

  test('discover 读取显式配置的 worker 路径', () {
    final File worker = File('${tmp.path}/runner_worker')
      ..writeAsStringSync('#!/bin/sh\n');
    final WorkerLauncher? launcher = WorkerLauncher.discover(
      env: <String, String>{'CONATUS_WORK_WORKER': worker.path},
    );
    expect(launcher, isNotNull);
    expect(launcher!.executable, worker.path);
  });
}
