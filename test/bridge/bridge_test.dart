import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/bridge.dart';
import 'package:test/test.dart';

const String _inputDir = 'test/fixtures/projection/organize-v01';
const String _committed = 'ui/src/fixtures/runs/organize-v01.json';

void main() {
  late Directory runsRoot;
  late WorkbenchBridge bridge;

  setUp(() {
    runsRoot = Directory.systemTemp.createTempSync('work-bridge-');
    final Directory target = Directory('${runsRoot.path}/organize-v01')..createSync();
    for (final FileSystemEntity entity in Directory(_inputDir).listSync(recursive: true)) {
      if (entity is! File) continue;
      final String relative = entity.path.substring(_inputDir.length + 1);
      final File copy = File('${target.path}/$relative');
      copy.parent.createSync(recursive: true);
      copy.writeAsStringSync(entity.readAsStringSync());
    }
    bridge = WorkbenchBridge(runsDir: runsRoot.path);
  });

  tearDown(() => runsRoot.deleteSync(recursive: true));

  test('listTasks 读出标题与状态', () {
    final List<RunSummary> tasks = bridge.listTasks();
    expect(tasks, hasLength(1));
    expect(tasks.single.title, '按类型和月份整理收件箱并生成变更清单');
    expect(tasks.single.status, 'succeeded');
    expect(tasks.single.id, 'organize-v01');
  });

  test('openTask 与已提交的 UI fixture 一致', () {
    final Object? expected = jsonDecode(File(_committed).readAsStringSync());
    expect(bridge.openTask('organize-v01').toJson(), equals(expected));
  });

  test('changes 返回记录里的移动数', () {
    expect(bridge.changes('organize-v01')?['summary'], containsPair('moved', 10));
  });

  test('readArtifact 返回登记过的产物正文', () {
    final String content = bridge.readArtifact('organize-v01', 'out/changes.md');
    expect(content, isNotEmpty);
    expect(content.startsWith('#'), isTrue);
  });

  test('readArtifact 拒绝未登记的路径', () {
    expect(
      () => bridge.readArtifact('organize-v01', 'out/secrets.txt'),
      throwsA(isA<StateError>()),
    );
  });

  test('未知 runId 被拒绝', () {
    expect(() => bridge.openTask('nope'), throwsA(isA<StateError>()));
    expect(() => bridge.openTask('../etc/passwd'), throwsA(isA<StateError>()));
    expect(() => bridge.undo('nope'), throwsA(isA<StateError>()));
  });
}
