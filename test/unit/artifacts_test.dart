import 'dart:io';
import 'package:conatus_work/src/runner/artifacts.dart';
import 'package:conatus_work/src/runner/hash.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;
  setUp(() => tmp = Directory.systemTemp.createTempSync('artifacts_'));
  tearDown(() => tmp.deleteSync(recursive: true));

  test('缺失 / 空 / 正常三种判定', () async {
    Directory('${tmp.path}/out').createSync();
    File('${tmp.path}/out/empty.md').writeAsStringSync('');
    File('${tmp.path}/out/ok.md').writeAsStringSync('abc');
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: tmp.path,
      expected: <String>['out/missing.md', 'out/empty.md', 'out/ok.md'],
    );
    expect(checks[0].passed, isFalse);
    expect(checks[0].reason, 'missing');
    expect(checks[1].passed, isFalse);
    expect(checks[1].reason, 'empty');
    expect(checks[2].passed, isTrue);
    expect(checks[2].bytes, 3);
    expect(checks[2].sha256, sha256Hex(<int>[0x61, 0x62, 0x63]));
  });

  test('run.json 的 check 形状含 exists / nonEmpty / passed', () {
    final ArtifactCheck missing = ArtifactCheck(path: 'a', reason: 'missing');
    final ArtifactCheck empty = ArtifactCheck(path: 'b', reason: 'empty');
    final ArtifactCheck ok = ArtifactCheck(path: 'c', passed: true);
    expect(missing.toJson()['check'], <String, Object?>{
      'exists': false,
      'nonEmpty': false,
      'passed': false,
      'reason': 'missing',
    });
    expect(empty.toJson()['check'], containsPair('nonEmpty', false));
    expect(ok.toJson()['check'], containsPair('nonEmpty', true));
  });
}
