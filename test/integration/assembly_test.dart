import 'dart:io';
import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/workspace.dart';
import 'package:test/test.dart';

TaskSpec card(String root) => TaskSpec.parse(<String, Object?>{
  'id': 'research-v01',
  'chain': 'research',
  'title': '调研',
  'workspace': <String, Object?>{
    'root': root,
    'read': <String>['inbox'],
    'write': <String>['out'],
  },
  'inputs': <String>[],
  'prompt': '写报告',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 20, 'maxCostUsd': 1.5},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
});

void main() {
  test('装配出 fs / tools / session / 检查点，并可释放', () async {
    final Directory tmp = Directory.systemTemp.createTempSync('assemble_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final WorkspacePlan workspace = await prepareWorkspace(
      task: card('work'),
      rootOverride: '${tmp.path}/work',
    );
    expect(Directory('${tmp.path}/work/out').existsSync(), isTrue);

    final RunPaths paths = RunPaths(
      runsDir: '${tmp.path}/runs',
      runId: 'run_x',
    );
    await paths.create();
    final RunScope scope = await assembleRun(
      task: card('work'),
      workspace: workspace,
      paths: paths,
    );
    expect(scope.session.id, 'events');
    expect(scope.checkpoint.turn, 0);
    expect(
      scope.toolNames,
      containsAll(<String>['read', 'write', 'move', 'mkdir']),
    );
    await expectLater(
      scope.fs.resolve('/etc/hosts').then(scope.fs.readText),
      throwsA(isA<FsError>()),
    );
    await scope.dispose();
    expect(scope.ctx.disposed, isTrue);
  });

  test('工作区根按 cwd 解析，覆盖值不二次拼接', () {
    expect(
      resolveWorkspaceRoot(task: card('work'), cwd: '/base'),
      '/base/work',
    );
    expect(
      resolveWorkspaceRoot(
        task: card('work'),
        rootOverride: 'rel/out',
        cwd: '/base',
      ),
      '/base/rel/out',
    );
    expect(
      resolveWorkspaceRoot(
        task: card('work'),
        rootOverride: '/abs/x',
        cwd: '/base',
      ),
      '/abs/x',
    );
  });
}
