import 'package:conatus_work/src/runner/validators.dart';
import 'package:test/test.dart';

String sourcesJson({int count = 6, int primary = 3, String status = 'ok'}) {
  final List<String> items = <String>[
    for (int i = 0; i < count; i++)
      '{"url":"https://e/$i","title":"t$i","fetch_status":"$status",'
          '"is_primary":${i < primary}}',
  ];
  return '{"sources":[${items.join(',')}]}';
}

String changesJson({
  int operations = 2,
  bool withSha = true,
  int moved = 2,
  int quarantined = 0,
  int deleted = 0,
}) {
  final List<String> ops = <String>[
    for (int i = 0; i < operations; i++)
      '{"from":"inbox/$i","to":"out/$i","reason":"r"'
          '${withSha ? ',"sha256":"abc$i"' : ''}}',
  ];
  return '{"operations":[${ops.join(',')}],'
      '"summary":{"moved":$moved,"quarantined":$quarantined,"deleted":$deleted}}';
}

void main() {
  test('sources-json：合格通过', () {
    expect(validateArtifact('sources-json', sourcesJson()), isNull);
  });

  test('sources-json：来源不足 / 一手不足 / 抓取失败 / 非法 JSON', () {
    expect(
      validateArtifact('sources-json', sourcesJson(count: 5)),
      'tooFewSources',
    );
    expect(
      validateArtifact('sources-json', sourcesJson(primary: 2)),
      'noPrimarySources',
    );
    expect(
      validateArtifact('sources-json', sourcesJson(status: 'error')),
      'invalidSource',
    );
    expect(validateArtifact('sources-json', 'not json'), 'invalidJson');
  });

  test('changes-manifest：合格通过', () {
    expect(validateArtifact('changes-manifest', changesJson()), isNull);
  });

  test('changes-manifest：缺 sha256 / 有删除 / 汇总不一致 / 非法 JSON', () {
    expect(
      validateArtifact('changes-manifest', changesJson(withSha: false)),
      startsWith('missingField:'),
    );
    expect(
      validateArtifact('changes-manifest', changesJson(deleted: 1)),
      'deletedFiles',
    );
    expect(
      validateArtifact('changes-manifest', changesJson(moved: 5)),
      'inconsistentSummary',
    );
    expect(validateArtifact('changes-manifest', '[]'), 'invalidJson');
  });
}
