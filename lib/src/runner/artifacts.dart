/// 期望产物的机检：存在、非空、指纹。
library;

import 'dart:io';

import 'hash.dart';
import 'run_store.dart';

/// 按 [expected] 的顺序逐个检查 `root` 下的产物。
Future<List<ArtifactCheck>> checkArtifacts({
  required String root,
  required List<String> expected,
}) async {
  final List<ArtifactCheck> checks = <ArtifactCheck>[];
  for (final String path in expected) {
    checks.add(await _checkOne(root, path));
  }
  return checks;
}

Future<ArtifactCheck> _checkOne(String root, String path) async {
  final File file = File('$root${Platform.pathSeparator}$path');
  final FileSystemEntityType type = await FileSystemEntity.type(file.path);
  if (type == FileSystemEntityType.notFound) {
    return ArtifactCheck(path: path, reason: 'missing');
  }
  if (type != FileSystemEntityType.file) {
    return ArtifactCheck(path: path, reason: 'notFile');
  }
  final List<int> bytes = await file.readAsBytes();
  if (bytes.isEmpty) {
    return ArtifactCheck(path: path, reason: 'empty');
  }
  return ArtifactCheck(
    path: path,
    bytes: bytes.length,
    sha256: sha256Hex(bytes),
    passed: true,
  );
}
