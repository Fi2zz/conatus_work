import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/undo.dart';
import 'package:conatus_work/src/tools/rooted_fs.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson() => <String, Object?>{
  'id': 'move-v01',
  'chain': 'organize',
  'title': '移动一个文件',
  'workspace': <String, Object?>{
    'root': 'work',
    'read': <String>['inbox'],
    'write': <String>['inbox', 'out'],
  },
  'inputs': <String>['inbox/a.txt'],
  'prompt': '把 inbox/a.txt 移到 out/',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
};

void main() {
  late Directory tmp;
  late Runner runner;
  late RunRecord record;

  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('redo_');
    File('${tmp.path}/card.json').writeAsStringSync(jsonEncode(cardJson()));
    Directory('${tmp.path}/work/inbox').createSync(recursive: true);
    File('${tmp.path}/work/inbox/a.txt').writeAsStringSync('a');
    runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (RunScope scope, TaskSpec task) async {
        await scope.fs.mkdir('out');
        await scope.fs.move('inbox/a.txt', 'out/a.txt');
        return const TaskOutcome.ok();
      },
    );
    record = await runner.run(
      RunRequest(
        task: TaskSpec.parse(cardJson()),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  test('undo 把撤销点落盘，redo 用它把文件恢复回去', () async {
    await runner.undo(record.runId);
    expect(File('${tmp.path}/work/inbox/a.txt').existsSync(), isTrue);
    final File stage = File(
      '${tmp.path}/runs/${record.runId}/revert-stage.json',
    );
    expect(stage.existsSync(), isTrue);

    final RunRecord redone = await runner.redo(record.runId);
    expect(File('${tmp.path}/work/out/a.txt').existsSync(), isTrue);
    expect(File('${tmp.path}/work/inbox/a.txt').existsSync(), isFalse);
    expect(redone.forkSessionId, isNull);
    expect(stage.existsSync(), isFalse, reason: '重做后撤销点应清除');
  });

  test('没有撤销点时 redo 明确报错', () async {
    expect(() => runner.redo(record.runId), throwsA(isA<StateError>()));
  });

  test('连续 undo → redo → undo 仍然可用', () async {
    await runner.undo(record.runId);
    await runner.redo(record.runId);
    await runner.undo(record.runId);
    expect(File('${tmp.path}/work/inbox/a.txt').existsSync(), isTrue);
    expect(File('${tmp.path}/work/out/a.txt').existsSync(), isFalse);
  });
}
