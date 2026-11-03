import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/projection.dart';
import 'package:test/test.dart';

const String _inputDir = 'test/fixtures/projection/organize-v01';
const String _expectedPath = 'ui/src/fixtures/runs/organize-v01.json';

void main() {
  test('organize-v01 投影与已提交的 UI fixture 完全一致', () {
    final RunFixture fixture = projectRunDir(_inputDir);
    final Object? expected = jsonDecode(
      File(_expectedPath).readAsStringSync(),
    );
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
    expect(fixture.files.keys, containsAll(<String>['out/changes.json', 'out/changes.md']));
    expect(fixture.changes?['summary'], containsPair('moved', 10));
    expect(fixture.run['workspaceRoot'], 'workspace');
  });
}
