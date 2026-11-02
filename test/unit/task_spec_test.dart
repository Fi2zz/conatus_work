import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:test/test.dart';

Map<String, Object?> validCard({
  Map<String, Object?>? workspace,
  Object? network = 'deny',
  Object? keep = 30,
  Object? chain = 'research',
}) => <String, Object?>{
  'id': 'research-v01',
  'chain': chain,
  'title': '调研并写报告',
  'workspace':
      workspace ??
      <String, Object?>{
        'root': 'var/workspaces/r1',
        'read': <String>['inbox'],
        'write': <String>['out'],
      },
  'inputs': <String>[],
  'prompt': '读 brief.md 写报告',
  'network': network,
  'expectedArtifacts': <String>['out/report.md'],
  'acceptance': <String>['有引用'],
  'limits': <String, Object?>{'maxMinutes': 20, 'maxCostUsd': 1.5},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': keep},
};

void main() {
  test('合法任务卡解析出全部字段', () {
    final TaskSpec spec = TaskSpec.parse(validCard());
    expect(spec.id, 'research-v01');
    expect(spec.chain, 'research');
    expect(spec.allowNetwork, isFalse);
    expect(spec.read, <String>['inbox']);
    expect(spec.write, <String>['out']);
    expect(spec.checkpointKeep, 30);
  });

  test('缺 network / 未知 chain / 非法路径 / keep<1 全部拒绝', () {
    final List<Map<String, Object?>> bad = <Map<String, Object?>>[
      validCard(network: null),
      validCard(chain: 'unknown'),
      validCard(
        workspace: <String, Object?>{
          'root': 'var/workspaces/r1',
          'read': <String>['/abs'],
          'write': <String>['out'],
        },
      ),
      validCard(
        workspace: <String, Object?>{
          'root': 'var/workspaces/r1',
          'read': <String>[],
          'write': <String>['../out'],
        },
      ),
      validCard(
        workspace: <String, Object?>{
          'root': 'var/workspaces/r1',
          'read': <String>[],
          'write': <String>[],
        },
      ),
      validCard(keep: 0),
    ];
    for (final Map<String, Object?> card in bad) {
      expect(() => TaskSpec.parse(card), throwsA(isA<TaskSpecError>()));
    }
  });
}
