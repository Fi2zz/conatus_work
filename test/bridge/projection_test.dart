import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/projection.dart';
import 'package:test/test.dart';

const String _inputDir = 'test/fixtures/projection/organize-v01';
const String _expectedPath = 'ui/src/fixtures/runs/organize-v01.json';

void main() {
  test('organize-v01 投影与已提交的 UI fixture 完全一致', () {
    final RunFixture fixture = projectRunDir(_inputDir);
    final Object? expected = jsonDecode(File(_expectedPath).readAsStringSync());
    expect(fixture.toJson(), equals(expected));
  });

  test('事件 seq 连续、at 单调不减', () {
    final RunFixture fixture = projectRunDir(_inputDir);
    for (int i = 0; i < fixture.events.length; i += 1) {
      expect(fixture.events[i]['seq'], i);
      if (i > 0) {
        final int previous = fixture.events[i - 1]['at']! as int;
        final int current = fixture.events[i]['at']! as int;
        expect(current >= previous, isTrue, reason: '第 $i 条事件时间回退');
      }
    }
  });

  test('产物正文与变更集来自自包含的 workspace', () {
    final RunFixture fixture = projectRunDir(_inputDir);
    expect(
      fixture.files.keys,
      containsAll(<String>['out/changes.json', 'out/changes.md']),
    );
    expect(fixture.changes?['summary'], containsPair('moved', 10));
    expect(fixture.run['workspaceRoot'], 'workspace');
  });

  test('turnHistory 投影成检查点轮次并算出空洞', () {
    final Directory tmp = Directory.systemTemp.createTempSync('projection_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final Directory runDir = Directory('${tmp.path}/organize-v01');
    _copyTree(Directory(_inputDir), runDir);
    final File runJson = File('${runDir.path}/run.json');
    final Map<String, Object?> run =
        jsonDecode(runJson.readAsStringSync()) as Map<String, Object?>;
    run['turns'] = <String, Object?>{'start': 0, 'end': 3};
    run['turnHistory'] = <Object?>[
      <String, Object?>{
        'turn': 3,
        'at': '2026-11-02T18:17:00+08:00',
        'eventCount': 99,
      },
      <String, Object?>{
        'turn': 1,
        'at': '2026-11-02T18:15:00+08:00',
        'eventCount': 12,
      },
      <String, Object?>{
        'turn': 3,
        'at': '2026-11-02T18:17:00+08:00',
        'eventCount': 18,
      },
    ];
    runJson.writeAsStringSync(jsonEncode(run));

    final RunFixture fixture = projectRunDir(runDir.path);
    final Map<String, Object?> checkpoints = fixture.checkpoints;
    final List<Object?> turns = checkpoints['turns']! as List<Object?>;
    expect(turns, hasLength(2));
    expect((turns.first as Map<String, Object?>)['turn'], 1);
    expect((turns.last as Map<String, Object?>)['eventCount'], 18);
    expect(checkpoints['gaps'], <Object?>[2]);
    expect(checkpoints['currentTurn'], 3);
  });
}

void _copyTree(Directory source, Directory target) {
  target.createSync(recursive: true);
  for (final FileSystemEntity entity in source.listSync()) {
    final String name = entity.uri.pathSegments.lastWhere(
      (String segment) => segment.isNotEmpty,
    );
    final String destination = '${target.path}/$name';
    if (entity is Directory) {
      _copyTree(entity, Directory(destination));
      continue;
    }
    (entity as File).copySync(destination);
  }
}
