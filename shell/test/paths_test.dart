import 'dart:io';

import 'package:conatus_work_shell/paths.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late Directory root;

  setUp(() {
    root = Directory.systemTemp.createTempSync('paths_');
    Directory('${root.path}/ui/dist').createSync(recursive: true);
    File('${root.path}/ui/dist/index.html').writeAsStringSync('<h1/>');
    Directory('${root.path}/var/runs').createSync(recursive: true);
  });

  tearDown(() => root.deleteSync(recursive: true));

  test('从可执行文件位置向上找到仓库根', () {
    final String executable =
        '${root.path}/shell/build/macos/Build/Products/Debug/app.app/Contents/MacOS/app';
    final List<String> roots = candidateRoots(
      cwd: '/',
      executable: executable,
    );
    expect(findUiDir(roots), '${root.path}/ui/dist');
    expect(findRunsDir(roots), '${root.path}/var/runs');
  });

  test('cwd 在仓库内时优先用 cwd', () {
    final String executable = '/tmp/app.app/Contents/MacOS/app';
    final List<String> roots = candidateRoots(
      cwd: '${root.path}/shell',
      executable: executable,
    );
    expect(findUiDir(roots), '${root.path}/ui/dist');
  });

  test('找不到构建产物时返回 null', () {
    final Directory empty = Directory.systemTemp.createTempSync('empty_');
    addTearDown(() => empty.deleteSync(recursive: true));
    final List<String> roots = candidateRoots(
      cwd: empty.path,
      executable: '${empty.path}/app.app/Contents/MacOS/app',
    );
    expect(findUiDir(roots), isNull);
    expect(findRunsDir(roots), isNull);
  });
}
