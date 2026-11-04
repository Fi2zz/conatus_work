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

/// 把 [sessionId] 的检查点裁到预算内；低到 2 轮（base + 1 个差量）为止。
///
/// 打开第二个存储实例只做 `prune`，不写快照；调用方应在运行收口、会话关闭后
/// 再执行，避免与在途快照竞争。
Future<int> enforceCheckpointBudget({
  required TaskSpec task,
  required String root,
  required String projectDir,
  required String sessionId,
  required int budgetBytes,
}) async {
  if (!task.checkpointEnabled) return task.checkpointKeep;
  final Directory checkpoints = Directory(
    '$projectDir${Platform.pathSeparator}checkpoints',
  );
  if (!checkpoints.existsSync()) return task.checkpointKeep;
  int keep = task.checkpointKeep;
  while (keep > 2 && directorySizeBytes(checkpoints) > budgetBytes) {
    keep = keep > 3 ? keep ~/ 2 : 2;
    final CheckpointStore store = await openCheckpointStore(
      options: CheckpointOptions(
        keep: keep,
        policy: productCheckpointPolicy(),
      ),
      root: root,
      projectDir: projectDir,
    );
    store.prune(sessionId);
  }
  return keep;
}
