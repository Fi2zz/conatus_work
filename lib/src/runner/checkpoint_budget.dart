/// 检查点磁盘预算：超出预算时逐步收紧 keep 并裁剪最旧轮次。
library;

import 'dart:io';

import 'package:conatus/conatus.dart';

import 'task_spec.dart';
import 'workspace.dart';

/// 默认预算：256 MB。
const int kDefaultCheckpointBudgetBytes = 256 * 1024 * 1024;

/// 从环境变量读预算（`WORK_CHECKPOINT_BUDGET_MB`），非法值回落默认。
int checkpointBudgetFromEnv(Map<String, String> env) {
  final int? megabytes = int.tryParse(env['WORK_CHECKPOINT_BUDGET_MB'] ?? '');
  if (megabytes == null || megabytes <= 0) {
    return kDefaultCheckpointBudgetBytes;
  }
  return megabytes * 1024 * 1024;
}

/// 递归统计目录占用字节数；目录不存在记 0。
int directorySizeBytes(Directory dir) {
  if (!dir.existsSync()) return 0;
  int total = 0;
  for (final FileSystemEntity entity in dir.listSync(followLinks: false)) {
    if (entity is File) {
      try {
        total += entity.lengthSync();
      } on FileSystemException {
        // 并发删除 / 权限问题跳过。
      }
      continue;
    }
    if (entity is Directory) total += directorySizeBytes(entity);
  }
  return total;
}

/// 一次预算清理的输入。
class BudgetRequest {
  const BudgetRequest({
    required this.task,
    required this.root,
    required this.projectDir,
    required this.sessionId,
    required this.budgetBytes,
  });

  final TaskSpec task;
  final String root;
  final String projectDir;
  final String sessionId;
  final int budgetBytes;
}

/// 把 [BudgetRequest.sessionId] 的检查点裁到预算内；返回最终 keep。
///
/// 影子 git 后端 `prune` 只删 ref，字节要等 `git gc` 才回收；每次裁剪后测一次
/// 实际回收量，没有进展就停止，避免把撤销历史白白裁到底。
Future<int> enforceCheckpointBudget(BudgetRequest request) async {
  final TaskSpec task = request.task;
  if (!task.checkpointEnabled) return task.checkpointKeep;
  final Directory checkpoints = Directory(
    '${request.projectDir}${Platform.pathSeparator}checkpoints',
  );
  if (!checkpoints.existsSync()) return task.checkpointKeep;
  int keep = task.checkpointKeep;
  int current = directorySizeBytes(checkpoints);
  while (keep > 2 && current > request.budgetBytes) {
    final CheckpointStore source = await openCheckpointStore(
      options: CheckpointOptions(keep: keep, policy: productCheckpointPolicy()),
      root: request.root,
      projectDir: request.projectDir,
    );
    final int turnCount = source.list(request.sessionId).length;
    if (turnCount <= 2) break;
    int next = keep > 3 ? keep ~/ 2 : 2;
    if (next >= turnCount) next = turnCount - 1;
    if (next < 2) next = 2;
    final CheckpointStore store = await openCheckpointStore(
      options: CheckpointOptions(keep: next, policy: productCheckpointPolicy()),
      root: request.root,
      projectDir: request.projectDir,
    );
    store.prune(request.sessionId);
    int after = directorySizeBytes(checkpoints);
    if (after > request.budgetBytes && after >= current) {
      await _collectGarbage(request.projectDir);
      after = directorySizeBytes(checkpoints);
    }
    if (after >= current) break;
    keep = next;
    current = after;
  }
  return keep;
}

Future<void> _collectGarbage(String projectDir) async {
  final Directory shadow = Directory(
    '$projectDir${Platform.pathSeparator}checkpoints'
    '${Platform.pathSeparator}shadow.git',
  );
  if (!shadow.existsSync()) return;
  try {
    await Process.run('git', <String>[
      '--git-dir',
      shadow.path,
      'gc',
      '--prune=now',
    ]);
  } on ProcessException {
    // git 不可用时只能接受 ref 已裁、字节未回收。
  }
}
