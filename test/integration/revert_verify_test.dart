import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/revert_verify.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/workspace.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson() => <String, Object?>{
  'id': 'verify-v01',
  'chain': 'organize',
  'title': '校验',
  'workspace': <String, Object?>{
    'root': 'work',
    'read': <String>['inbox'],
    'write': <String>['inbox', 'out'],
  },
  'inputs': <String>[],
  'prompt': '写一个文件',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
};

void main() {
  late Directory tmp;
  late String cardPath;
  late RunRecord record;
  late CheckpointStore store;

  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('verify_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
    record =
        await Runner(
          runsDir: '${tmp.path}/runs',
          body: (RunScope scope, TaskSpec task) async {
            File('${tmp.path}/work/out/a.txt').writeAsStringSync('hello');
            return const TaskOutcome.ok();
          },
        ).run(
          RunRequest(
            task: TaskSpec.parse(cardJson()),
            taskPath: cardPath,
            workspaceRoot: '${tmp.path}/work',
          ),
        );
    store = await openCheckpointStore(
      options: CheckpointOptions(
        keep: 30,
        policy: productCheckpointPolicy(),
      ),
      root: record.workspaceRoot,
      projectDir: RunPaths(
        runsDir: '${tmp.path}/runs',
        runId: record.runId,
      ).runDir,
    );
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  VerifyRequest request() => VerifyRequest(
    store: store,
    sessionId: record.sessionId,
    turn: record.endTurn!,
    root: record.workspaceRoot,
    projectDir: RunPaths(
      runsDir: '${tmp.path}/runs',
      runId: record.runId,
    ).runDir,
    policy: productCheckpointPolicy(),
  );

  test('撤销后工作区与检查点一致', () async {
    expect(await workspaceMatchesCheckpoint(request()), isTrue);
  });

  test('文件内容变化判定为二次损坏', () async {
    File('${tmp.path}/work/out/a.txt').writeAsStringSync('changed');
    expect(await workspaceMatchesCheckpoint(request()), isFalse);
  });

  test('多出未入检查点的文件判定为二次损坏', () async {
    File('${tmp.path}/work/out/extra.txt').writeAsStringSync('extra');
    expect(await workspaceMatchesCheckpoint(request()), isFalse);
  });
}
