/// allow-list 读写边界：`FileSystem` 装饰器。
///
/// 读与写各自只放行工作区根下的若干前缀，判定只认规范路径（`inner.processPath`，
/// 即真实路径）。因此 `out/link -> /etc` 这类符号链接逃逸天然被挡住：写入落到
/// `/etc/...` 时目标已不在根下。
///
/// 与 `ReadOnlyPathGuard`（deny-list、双拼写比较）方向相反，两者不可互换。
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:conatus/conatus.dart';

part 'rooted_fs_ops.dart';

/// 把读写限制在工作区根与其前缀内的装饰器。
class RootedFileSystem implements FileSystem {
  /// 用被装饰的 [inner]、根 [root] 与两组前缀构造。
  ///
  /// [readPrefixes] 是**完整读集合**：调用方应传 `read ∪ write`，否则写过的
  /// 产物自己都读不到。[writePrefixes] 决定哪些前缀可写。
  factory RootedFileSystem({
    required FileSystem inner,
    required String root,
    required Iterable<String> readPrefixes,
    required Iterable<String> writePrefixes,
  }) {
    final String rootReal = _real(root);
    return RootedFileSystem._(
      inner,
      rootReal,
      _prefixRoots(rootReal, readPrefixes),
      _prefixRoots(rootReal, writePrefixes),
    );
  }

  RootedFileSystem._(
    this.inner,
    this._rootReal,
    this._readRoots,
    this._writeRoots,
  );

  /// 实际执行 I/O 的后端。
  final FileSystem inner;

  final String _rootReal;
  final List<String> _readRoots;
  final List<String> _writeRoots;

  @override
  Future<FsTarget> resolve(String path, {String? cwd}) =>
      inner.resolve(path, cwd: cwd);

  @override
  String processPath(FsTarget target) => inner.processPath(target);

  @override
  String fileUrl(FsTarget target) => inner.fileUrl(target);

  @override
  bool contains(FsTarget parent, FsTarget child) =>
      inner.contains(parent, child);

  @override
  Future<FsInfo?> stat(FsTarget target) async {
    _requireRead(target);
    return inner.stat(target);
  }

  @override
  Future<FsPathInfo?> lstat(String path, {String? cwd}) async {
    _requireRead(await inner.resolve(_parentOf(path), cwd: cwd));
    return inner.lstat(path, cwd: cwd);
  }

  @override
  Future<String> readText(FsTarget target) async {
    _requireRead(target);
    return inner.readText(target);
  }

  @override
  Future<Uint8List> readBytes(FsTarget target) async {
    _requireRead(target);
    return inner.readBytes(target);
  }

  @override
  Future<List<FsDirEntry>> listDir(FsTarget target) async {
    _requireRead(target);
    final List<FsDirEntry> entries = await inner.listDir(target);
    final List<FsDirEntry> safe = <FsDirEntry>[];
    for (final FsDirEntry entry in entries) {
      safe.add(
        FsDirEntry(
          name: entry.name,
          type: entry.type,
          target: await inner.resolve(entry.target.displayPath),
          size: entry.size,
        ),
      );
    }
    return safe;
  }

  @override
  Future<FsWriteOutcome> writeText(
    FsTarget target,
    String content, {
    FsWriteIntent? expected,
  }) async {
    _requireWrite(target);
    return inner.writeText(target, content, expected: expected);
  }

  @override
  Future<FsEditOutcome> editText(
    FsTarget target,
    FsEditRequest edit, {
    String? expectedVersion,
  }) async {
    _requireWrite(target);
    return inner.editText(target, edit, expectedVersion: expectedVersion);
  }

  @override
  Future<void> remove(FsTarget target) async {
    _requireWrite(target);
    _requireRemovable(target);
    await inner.remove(target);
  }

  void _requireRead(FsTarget target) {
    final String path = _canonical(target);
    if (_samePath(path, _rootReal) || _underAny(path, _readRoots)) return;
    throw FsError(
      FsErrorCode.sandboxDenied,
      '目标不在允许的读取范围内：${target.displayPath}',
    );
  }

  void _requireWrite(FsTarget target) {
    if (_underAny(_canonical(target), _writeRoots)) return;
    throw FsError(
      FsErrorCode.sandboxDenied,
      '目标不在允许的写入范围内：${target.displayPath}',
    );
  }

  void _requireRemovable(FsTarget target) {
    if (!underReadOnlyRoot(_rootReal, _canonical(target))) return;
    throw FsError(
      FsErrorCode.sandboxDenied,
      '不能删除工作区根或其祖先：${target.displayPath}',
    );
  }

  String _canonical(FsTarget target) =>
      normalizeReadOnlyPath(inner.processPath(target));
}

String _real(String path) {
  final String absolute = Directory(path).absolute.path;
  return normalizeReadOnlyPath(realPathViaAncestor(absolute) ?? absolute);
}

List<String> _prefixRoots(String rootReal, Iterable<String> prefixes) {
  final List<String> roots = <String>[];
  for (final String prefix in prefixes) {
    if (prefix.trim().isEmpty || _unsafePrefix(prefix)) {
      throw ArgumentError('读写前缀必须是根下相对路径：$prefix');
    }
    final String real = _real('$rootReal${Platform.pathSeparator}$prefix');
    if (!underReadOnlyRoot(real, rootReal)) {
      throw ArgumentError('读写前缀解析到工作区根之外：$prefix');
    }
    roots.add(real);
  }
  return roots;
}

bool _unsafePrefix(String prefix) =>
    prefix.startsWith('/') || prefix.split(RegExp(r'[/\\]')).contains('..');

bool _underAny(String path, List<String> roots) {
  for (final String root in roots) {
    if (underReadOnlyRoot(path, root)) return true;
  }
  return false;
}

bool _samePath(String a, String b) =>
    underReadOnlyRoot(a, b) && underReadOnlyRoot(b, a);
