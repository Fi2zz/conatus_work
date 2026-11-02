part of 'rooted_fs.dart';

/// 一次移动的结局。
class MoveResult {
  const MoveResult({
    required this.fromPath,
    required this.toPath,
    this.bytes = 0,
  });

  /// 源路径（调用方传入的相对路径）。
  final String fromPath;

  /// 目标路径（调用方传入的相对路径）。
  final String toPath;

  /// 移动的字节数；目录为 0。
  final int bytes;
}

/// 目录与移动原语：`FileSystem` 抽象没有它们，只在本装饰器上提供。
extension RootedFileSystemOps on RootedFileSystem {
  /// 递归创建目录；已存在且是目录时幂等成功。
  Future<void> mkdir(String path) async {
    final FsTarget target = await resolve(path);
    _requireWrite(target);
    final Directory directory = Directory(inner.processPath(target));
    if (directory.existsSync()) return;
    await directory.create(recursive: true);
  }

  /// 移动文件或目录；目标已存在时失败，不覆盖。
  Future<MoveResult> move(String from, String to) async {
    final FsTarget source = await resolve(from);
    final FsTarget destination = await resolve(to);
    _requireWrite(source);
    _requireWrite(destination);
    final FsInfo? info = await inner.stat(source);
    if (info == null) {
      throw FsError(FsErrorCode.notFound, '源不存在：$from');
    }
    if (await inner.stat(destination) != null) {
      throw FsError(FsErrorCode.ioError, '目标已存在：$to');
    }
    final String sourcePath = inner.processPath(source);
    final String destinationPath = inner.processPath(destination);
    await Directory(_parentOf(destinationPath)).create(recursive: true);
    if (info.type == FsFileType.directory) {
      await Directory(sourcePath).rename(destinationPath);
      return MoveResult(fromPath: from, toPath: to);
    }
    await File(sourcePath).rename(destinationPath);
    return MoveResult(fromPath: from, toPath: to, bytes: info.size ?? 0);
  }
}

String _parentOf(String path) {
  final int cut = path.lastIndexOf(RegExp(r'[/\\]'));
  return cut <= 0 ? '.' : path.substring(0, cut);
}
