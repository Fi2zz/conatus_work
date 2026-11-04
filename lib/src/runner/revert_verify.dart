/// 撤销后的工作区校验：文件数是否少于目标检查点。
library;

import 'dart:io';

import 'package:conatus/conatus.dart';

/// 一次校验需要的输入。
class VerifyRequest {
  const VerifyRequest({
    required this.store,
    required this.sessionId,
    required this.turn,
    required this.root,
    required this.projectDir,
    required this.policy,
  });

  final CheckpointStore store;
  final String sessionId;
  final int turn;
  final String root;
  final String projectDir;
  final CheckpointPolicy policy;
}

/// 当前工作区的有效文件数是否不少于 [VerifyRequest.turn] 的目标文件数。
///
/// 只做「缺失」判定：影子 git 后端的清单不带路径，逐文件读内容要为每个文件
/// 启一个 `git show`（几千文件会把 undo 拖到几十秒），因此不在这里做内容比对。
/// 多出的文件不判损坏（可能是全局 gitignore 排除的临时文件）；文件缺失才是
/// 二次数据损失。
Future<bool> workspaceMatchesCheckpoint(VerifyRequest request) async {
  final Iterable<CheckpointInfo> target = request.store
      .list(request.sessionId)
      .where((CheckpointInfo info) => info.turn == request.turn);
  if (target.isEmpty) return false;
  final int expectedFiles = target.first.files;
  final String projectRel = _projectRel(request.root, request.projectDir);
  int present = 0;
  await for (final FileSystemEntity entity in checkpointWalk(
    request.root,
    projectRel,
    request.policy,
  )) {
    if (entity is File) present += 1;
  }
  return present >= expectedFiles;
}

/// 与存储实现同口径：`projectDir` 相对 `root`；不在根下则保留绝对路径。
String _projectRel(String root, String projectDir) {
  final String sep = Platform.pathSeparator;
  final String absRoot = Directory(root).absolute.path;
  final String absProject = Directory(projectDir).absolute.path;
  final String prefix = absRoot.endsWith(sep) ? absRoot : '$absRoot$sep';
  return absProject.startsWith(prefix)
      ? absProject.substring(prefix.length)
      : absProject;
}
