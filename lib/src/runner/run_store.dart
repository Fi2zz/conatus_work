/// `run.json` 的读写：同目录临时文件 + rename 保证原子。
library;

import 'dart:convert';
import 'dart:io';

import 'run_paths.dart';
import 'run_types.dart';

export 'run_types.dart';

/// 单个运行的 `run.json` 存取。
class RunStore {
  RunStore(this.paths);

  /// 运行目录布局。
  final RunPaths paths;

  /// 原子写入 `run.json`。
  Future<void> save(RunRecord record) async {
    final File target = File(paths.runJsonPath);
    await target.parent.create(recursive: true);
    final File staging = File('${target.path}.tmp');
    await staging.writeAsString(
      const JsonEncoder.withIndent('  ').convert(record.toJson()),
      flush: true,
    );
    await staging.rename(target.path);
  }

  /// 读取 `run.json`。
  Future<RunRecord> load() async {
    final Object? decoded = jsonDecode(
      await File(paths.runJsonPath).readAsString(),
    );
    if (decoded is! Map<String, Object?>) {
      throw const FormatException('run.json 必须是 JSON 对象');
    }
    return RunRecord.fromJson(decoded);
  }
}

/// 把检查点收口结果写进记录：只动检查点状态，不改任务状态。
RunRecord applySnapshot(RunRecord record, String? error) {
  record
    ..checkpointStatus = error == null
        ? CheckpointStatus.ok
        : CheckpointStatus.error
    ..checkpointError = error;
  return record;
}

/// 检查点失败且没有业务失败时，把任务升级为 `failed/checkpoint`。
RunRecord applyCheckpointFailure(RunRecord record, String? error) {
  if (error == null || record.failure.category != null) return record;
  if (record.status != TaskRunStatus.succeeded &&
      record.status != TaskRunStatus.running) {
    return record;
  }
  record.failure = RunFailure(
    category: FailureCategory.checkpoint,
    message: error,
  );
  if (record.status == TaskRunStatus.succeeded) {
    record.status = TaskRunStatus.failed;
  }
  return record;
}
