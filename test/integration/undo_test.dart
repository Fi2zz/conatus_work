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
  late String cardPath;
  setUp(() {
    tmp = Directory.systemTemp.createTempSync('undo_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
    Directory('${tmp.path}/work/inbox').createSync(recursive: true);
    File('${tmp.path}/work/inbox/a.txt').writeAsStringSync('a');
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('撤销把工作区恢复到运行前', () async {
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (RunScope scope, TaskSpec task) async {
        await scope.fs.mkdir('out');
        await scope.fs.move('inbox/a.txt', 'out/a.txt');
        return const TaskOutcome.ok();
      },
    );
    final RunRecord record = await runner.run(
      RunRequest(
        task: TaskSpec.parse(cardJson()),
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    expect(record.status, TaskRunStatus.succeeded);
    expect(File('${tmp.path}/work/out/a.txt').existsSync(), isTrue);

    final RunRecord undone = await runner.undo(record.runId);
    expect(File('${tmp.path}/work/inbox/a.txt').existsSync(), isTrue);
    expect(File('${tmp.path}/work/out/a.txt').existsSync(), isFalse);
    expect(undone.forkSessionId, isNotNull);
  });
}
