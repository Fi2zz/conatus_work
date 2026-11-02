/// fixture 拷贝：把样例输入安全地搬进工作区根。
library;

import 'dart:io';

import 'package:conatus/conatus.dart'
    show normalizeReadOnlyPath, realPathViaAncestor, underReadOnlyRoot;

/// fixture 拷贝失败。
class FixtureError implements Exception {
  const FixtureError(this.message);

  /// 人可读的失败说明。
  final String message;

  @override
  String toString() => 'FixtureError: $message';
}

/// 把 [fixtureDir] 递归拷进 [rootAbsolute]；已存在的文件一律拒绝覆盖。
Future<void> copyFixture({
  required String fixtureDir,
  required String rootAbsolute,
}) async {
  final String source = Directory(fixtureDir).absolute.path;
  if (!Directory(source).existsSync()) {
    throw FixtureError('fixture 目录不存在：$fixtureDir');
  }
  final String root = _real(rootAbsolute);
  await Directory(root).create(recursive: true);
  await _copyTree(_real(source), root, root);
}

Future<void> _copyTree(String source, String target, String root) async {
  for (final FileSystemEntity entity in Directory(
    source,
  ).listSync(followLinks: false)) {
    final String name = entity.path.split(Platform.pathSeparator).last;
    final String destination = '$target${Platform.pathSeparator}$name';
    _guardEntry(entity, destination, root);
    if (entity is Directory) {
      await Directory(destination).create(recursive: true);
      await _copyTree(entity.path, destination, root);
      continue;
    }
    await _copyFile(entity as File, destination);
  }
}

/// 目标必须留在根内，且 fixture 不允许携带符号链接。
void _guardEntry(FileSystemEntity entity, String destination, String root) {
  if (!underReadOnlyRoot(destination, root)) {
    throw FixtureError('fixture 项逃出工作区：${entity.path}');
  }
  if (entity is Link) {
    throw FixtureError('fixture 不允许符号链接：${entity.path}');
  }
}

Future<void> _copyFile(File source, String destination) async {
  if (File(destination).existsSync() || Directory(destination).existsSync()) {
    throw FixtureError('目标已存在，拒绝覆盖：$destination');
  }
  await source.copy(destination);
}

String _real(String path) {
  final String absolute = Directory(path).absolute.path;
  return normalizeReadOnlyPath(realPathViaAncestor(absolute) ?? absolute);
}
