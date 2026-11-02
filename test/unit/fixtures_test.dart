import 'dart:io';
import 'package:conatus_work/src/runner/fixtures.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;
  late String fixtureDir;
  late String root;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('fixtures_');
    fixtureDir = '${tmp.path}/fixture';
    root = '${tmp.path}/work';
    Directory('$fixtureDir/inbox/nested').createSync(recursive: true);
    Directory('$fixtureDir/out').createSync(recursive: true);
    File('$fixtureDir/inbox/brief.md').writeAsStringSync('b');
    File('$fixtureDir/inbox/nested/x.txt').writeAsStringSync('x');
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('递归拷入工作区，空目录也建出来', () async {
    await copyFixture(fixtureDir: fixtureDir, rootAbsolute: root);
    expect(File('$root/inbox/brief.md').readAsStringSync(), 'b');
    expect(File('$root/inbox/nested/x.txt').readAsStringSync(), 'x');
    expect(Directory('$root/out').existsSync(), isTrue);
  });

  test('目标文件已存在则拒绝覆盖', () async {
    Directory('$root/inbox').createSync(recursive: true);
    File('$root/inbox/brief.md').writeAsStringSync('原文件');
    await expectLater(
      copyFixture(fixtureDir: fixtureDir, rootAbsolute: root),
      throwsA(isA<FixtureError>()),
    );
    expect(File('$root/inbox/brief.md').readAsStringSync(), '原文件');
  });

  test('fixture 里的符号链接直接拒绝', () async {
    Link('$fixtureDir/inbox/link').createSync('/etc/hosts');
    await expectLater(
      copyFixture(fixtureDir: fixtureDir, rootAbsolute: root),
      throwsA(isA<FixtureError>()),
    );
  });

  test('fixture 目录不存在时报错', () async {
    await expectLater(
      copyFixture(fixtureDir: '${tmp.path}/nope', rootAbsolute: root),
      throwsA(isA<FixtureError>()),
    );
  });
}
