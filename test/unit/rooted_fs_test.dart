import 'dart:io';
import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/tools/rooted_fs.dart';
import 'package:test/test.dart';

RootedFileSystem openFs(String root) => RootedFileSystem(
  inner: LocalFileSystem(cwd: root),
  root: root,
  readPrefixes: <String>['inbox', 'out'],
  writePrefixes: <String>['out'],
);

Matcher sandboxDenied() => throwsA(
  isA<FsError>().having(
    (FsError e) => e.code,
    'code',
    FsErrorCode.sandboxDenied,
  ),
);

void main() {
  late Directory tmp;
  late RootedFileSystem fs;
  setUp(() {
    tmp = Directory.systemTemp.createTempSync('rooted_fs_');
    for (final String d in <String>['inbox', 'out']) {
      Directory('${tmp.path}/$d').createSync(recursive: true);
    }
    fs = openFs(tmp.path);
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('写 out/ 放行', () async {
    final FsTarget t = await fs.resolve('out/report.md');
    await fs.writeText(t, 'ok');
    expect(File('${tmp.path}/out/report.md').readAsStringSync(), 'ok');
  });

  test('out-evil/ 与 ../ 拒绝', () async {
    Directory('${tmp.path}/out-evil').createSync();
    await expectLater(
      fs.resolve('out-evil/x.md').then((t) => fs.writeText(t, 'x')),
      sandboxDenied(),
    );
    await expectLater(
      fs.resolve('../escape.md').then((t) => fs.writeText(t, 'x')),
      sandboxDenied(),
    );
  });

  test('符号链接逃逸拒绝', () async {
    final String outside = Directory.systemTemp.createTempSync('outside_').path;
    addTearDown(() => Directory(outside).deleteSync(recursive: true));
    Link('${tmp.path}/out/link').createSync(outside);
    await expectLater(
      fs.resolve('out/link/x.md').then((t) => fs.writeText(t, 'x')),
      sandboxDenied(),
    );
  });

  test('读白名单：inbox 放行、根外拒绝，out 因可写而可读', () async {
    File('${tmp.path}/inbox/brief.md').writeAsStringSync('b');
    expect(await fs.readText(await fs.resolve('inbox/brief.md')), 'b');
    expect(await fs.readText(await fs.resolve('out/../inbox/brief.md')), 'b');
    await expectLater(
      fs.resolve('/etc/hosts').then((t) => fs.readText(t)),
      sandboxDenied(),
    );
  });

  test('根可列举不可写，remove(root) 拒绝', () async {
    expect(
      (await fs.listDir(await fs.resolve('.'))).map((e) => e.name),
      containsAll(<String>['inbox', 'out']),
    );
    await expectLater(
      fs.resolve('.').then((t) => fs.writeText(t, 'x')),
      sandboxDenied(),
    );
    await expectLater(fs.remove(await fs.resolve('.')), sandboxDenied());
  });

  test('listDir 返回的 entry 不能绕过读边界（符号链接）', () async {
    Link('${tmp.path}/out/leak').createSync('/etc/hosts');
    final List<FsDirEntry> entries = await fs.listDir(await fs.resolve('out'));
    final FsDirEntry entry = entries.firstWhere(
      (FsDirEntry e) => e.name == 'leak',
    );
    await expectLater(fs.readText(entry.target), sandboxDenied());
  });

  test('写前缀本身是根外符号链接时 fail-closed', () {
    final String outside = Directory.systemTemp.createTempSync('prefix_').path;
    addTearDown(() => Directory(outside).deleteSync(recursive: true));
    final Directory other = Directory.systemTemp.createTempSync('prefix_root_');
    addTearDown(() => other.deleteSync(recursive: true));
    Link('${other.path}/out').createSync(outside);
    expect(
      () => RootedFileSystem(
        inner: LocalFileSystem(cwd: other.path),
        root: other.path,
        readPrefixes: <String>['out'],
        writePrefixes: <String>['out'],
      ),
      throwsA(isA<ArgumentError>()),
    );
  });

  test('lstat 检查链接本身不跟随目标', () async {
    final String outside = Directory.systemTemp.createTempSync('lstat_').path;
    addTearDown(() => Directory(outside).deleteSync(recursive: true));
    Link('${tmp.path}/out/link').createSync(outside);
    final FsPathInfo? info = await fs.lstat('out/link');
    expect(info?.type, FsFileType.symlink);
  });
}
