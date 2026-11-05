import 'dart:io';

import 'package:conatus_work/src/runner/worker_job.dart';
import 'package:test/test.dart';

void main() {
  test('worker job 往返保留全部字段', () async {
    final Directory tmp = Directory.systemTemp.createTempSync('job_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final WorkerJob job = WorkerJob(
      runsDir: '${tmp.path}/runs',
      runId: 'run_1',
      cardPath: '${tmp.path}/card.json',
      workspaceRoot: '${tmp.path}/work',
      mode: 'continue',
      text: '继续',
      budgetBytes: 1024,
    );
    final String path = '${tmp.path}/job.json';
    await job.write(path);
    final WorkerJob loaded = WorkerJob.read(path);
    expect(loaded.runsDir, job.runsDir);
    expect(loaded.runId, 'run_1');
    expect(loaded.mode, 'continue');
    expect(loaded.text, '继续');
    expect(loaded.budgetBytes, 1024);
  });
}
