import 'dart:io';
import 'package:conatus_work/src/runner/artifacts.dart';
import 'package:conatus_work/src/runner/hash.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
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

  test('minChars / contains / requireSvg 三条规则', () async {
    Directory('${tmp.path}/out').createSync();
    File('${tmp.path}/out/short.md').writeAsStringSync('abc');
    File('${tmp.path}/out/no-title.md').writeAsStringSync('正文没有标题');
    File('${tmp.path}/out/bad.svg').writeAsStringSync('not svg');
    File(
      '${tmp.path}/out/good.svg',
    ).writeAsStringSync('<?xml version="1.0"?><svg xmlns="x"></svg>');
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: tmp.path,
      expected: <String>[
        'out/short.md',
        'out/no-title.md',
        'out/bad.svg',
        'out/good.svg',
      ],
      rules: <String, ArtifactRule>{
        'out/short.md': const ArtifactRule(minChars: 5),
        'out/no-title.md': const ArtifactRule(contains: <String>['## 结论']),
        'out/bad.svg': const ArtifactRule(requireSvg: true),
        'out/good.svg': const ArtifactRule(requireSvg: true),
      },
    );
    expect(checks[0].reason, 'tooShort');
    expect(checks[1].reason, 'missingText');
    expect(checks[2].reason, 'invalidSvg');
    expect(checks[3].passed, isTrue);
    expect(checks[0].bytes, 3);
  });

  test('中文按非空白字符计数', () async {
    Directory('${tmp.path}/out').createSync();
    File('${tmp.path}/out/zh.md').writeAsStringSync('本地 优先\n工作台');
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: tmp.path,
      expected: <String>['out/zh.md'],
      rules: <String, ArtifactRule>{
        'out/zh.md': const ArtifactRule(minChars: 8),
      },
    );
    expect(checks.single.reason, 'tooShort');
    final List<ArtifactCheck> ok = await checkArtifacts(
      root: tmp.path,
      expected: <String>['out/zh.md'],
      rules: <String, ArtifactRule>{
        'out/zh.md': const ArtifactRule(minChars: 7),
      },
    );
    expect(ok.single.passed, isTrue);
  });

  test('maxChars 超限 → tooLong，边界值放行', () async {
    Directory('${tmp.path}/out').createSync();
    File('${tmp.path}/out/long.md').writeAsStringSync('abcdef');
    File('${tmp.path}/out/edge.md').writeAsStringSync('abcde');
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: tmp.path,
      expected: <String>['out/long.md', 'out/edge.md'],
      rules: <String, ArtifactRule>{
        'out/long.md': const ArtifactRule(maxChars: 5),
        'out/edge.md': const ArtifactRule(maxChars: 5),
      },
    );
    expect(checks[0].reason, 'tooLong');
    expect(checks[1].passed, isTrue);
  });
}
