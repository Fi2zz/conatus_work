import 'dart:io';
import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/tools/mkdir.dart';
import 'package:conatus_work/src/tools/move.dart';
import 'package:conatus_work/src/tools/rooted_fs.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;
  late RootedFileSystem fs;
  setUp(() {
    tmp = Directory.systemTemp.createTempSync('fs_ops_');
    for (final String d in <String>['inbox', 'out']) {
      Directory('${tmp.path}/$d').createSync(recursive: true);
    }
    fs = RootedFileSystem(
      inner: LocalFileSystem(cwd: tmp.path),
      root: tmp.path,
      readPrefixes: <String>['inbox', 'out'],
      writePrefixes: <String>['out'],
    );
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('mkdir 递归创建且幂等', () async {
    await fs.mkdir('out/a/b');
    await fs.mkdir('out/a/b');
    expect(Directory('${tmp.path}/out/a/b').existsSync(), isTrue);
    await expectLater(fs.mkdir('inbox/x'), throwsA(isA<FsError>()));
  });

  test('move 重命名，目标已存在则失败', () async {
    File('${tmp.path}/out/a.txt').writeAsStringSync('12345');
    final MoveResult result = await fs.move('out/a.txt', 'out/b.txt');
    expect(result.bytes, 5);
    expect(
      result.sha256,
      '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5',
    );
    expect(File('${tmp.path}/out/b.txt').existsSync(), isTrue);
    File('${tmp.path}/out/c.txt').writeAsStringSync('c');
    await expectLater(
      fs.move('out/b.txt', 'out/c.txt'),
      throwsA(isA<FsError>()),
    );
    expect(File('${tmp.path}/out/c.txt').readAsStringSync(), 'c');
  });

  test('move 源在只读区或目标越界都拒绝', () async {
    File('${tmp.path}/inbox/x.txt').writeAsStringSync('x');
    await expectLater(
      fs.move('inbox/x.txt', 'out/x.txt'),
      throwsA(isA<FsError>()),
    );
    await expectLater(
      fs.move('out/x.txt', '../y.txt'),
      throwsA(isA<FsError>()),
    );
  });

  test('工具形状与执行', () async {
    final MkdirTool mkdir = MkdirTool(fs: fs);
    expect(mkdir.name, 'mkdir');
    expect(mkdir.params.map((p) => p.name), <String>['path']);
    final ToolResult ok = await mkdir.call(
      const ToolContext(
        ToolCall(name: 'mkdir', arguments: <String, Object?>{'path': 'out/d'}),
      ),
    );
    expect(ok.isError, isFalse);
    final MoveTool move = MoveTool(fs: fs);
    expect(move.name, 'move');
    expect(move.pathParams, <String>['from', 'to']);
    expect(move.riskLevel, ToolRisk.medium);
  });
}
