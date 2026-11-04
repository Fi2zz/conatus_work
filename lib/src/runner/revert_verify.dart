/// 撤销后的工作区校验：当前文件与目标检查点是否一致。
library;

import 'dart:io';

import 'package:conatus/conatus.dart';

import 'hash.dart';

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

/// 当前工作区是否与 [VerifyRequest.turn] 的检查点逐文件一致。
///
/// 只判断是否一致，不在不一致时收集明细；撤销失败明细仍由 undo 的错误路径给。
/// 影子 git 后端的清单不带路径，因此以「当前工作区」为遍历源：每个应入快照的
/// 文件都必须能在目标轮次读到且内容一致，文件总数还必须与目标轮次的有效文件数
/// 相等（多出或少掉都算损坏）。
Future<bool> workspaceMatchesCheckpoint(VerifyRequest request) async {
  final List<CheckpointInfo> infos = request.store
      .list(request.sessionId)
      .where((CheckpointInfo info) => info.turn <= request.turn)
      .toList();
  final Iterable<CheckpointInfo> target = infos.where(
    (CheckpointInfo info) => info.turn == request.turn,
  );
  if (target.isEmpty) return false;
  final int expectedFiles = target.first.files;
  final String projectRel = checkpointRelativeTo(
    Directory(request.projectDir),
    request.root,
  );
  int matched = 0;
  await for (final FileSystemEntity entity in checkpointWalk(
    request.root,
    projectRel,
    request.policy,
  )) {
    final String path = checkpointRelativeTo(entity, request.root);
    final List<int>? expected = await request.store.readFile(
      request.sessionId,
      request.turn,
      path,
    );
    if (expected == null) return false;
    if (sha256Hex(await (entity as File).readAsBytes()) !=
        sha256Hex(expected)) {
      return false;
    }
    matched += 1;
  }
  return matched == expectedFiles;
}
