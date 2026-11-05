/// worker 进程的一次任务描述：宿主写 JSON，worker 读后执行。
library;

import 'dart:convert';
import 'dart:io';

/// 一次 worker 任务。
class WorkerJob {
  const WorkerJob({
    required this.runsDir,
    required this.runId,
    required this.cardPath,
    required this.workspaceRoot,
    this.mode = 'run',
    this.fixtureDir,
    this.text,
    this.confirmed = true,
    this.budgetBytes,
  });

  /// 运行记录根目录。
  final String runsDir;

  /// 运行 id（由宿主预先生成）。
  final String runId;

  /// 任务卡路径。
  final String cardPath;

  /// 工作区根（绝对路径）。
  final String workspaceRoot;

  /// `run` 或 `continue`。
  final String mode;

  /// fixture 目录（仅 run）。
  final String? fixtureDir;

  /// 续写文本（仅 continue）。
  final String? text;

  /// 是否已确认执行。
  final bool confirmed;

  /// 检查点预算（字节）。
  final int? budgetBytes;

  Map<String, Object?> toJson() => <String, Object?>{
    'runsDir': runsDir,
    'runId': runId,
    'cardPath': cardPath,
    'workspaceRoot': workspaceRoot,
    'mode': mode,
    if (fixtureDir != null) 'fixtureDir': fixtureDir,
    if (text != null) 'text': text,
    'confirmed': confirmed,
    if (budgetBytes != null) 'budgetBytes': budgetBytes,
  };

  static WorkerJob fromJson(Map<String, Object?> json) => WorkerJob(
    runsDir: json['runsDir'] as String? ?? '',
    runId: json['runId'] as String? ?? '',
    cardPath: json['cardPath'] as String? ?? '',
    workspaceRoot: json['workspaceRoot'] as String? ?? '',
    mode: json['mode'] as String? ?? 'run',
    fixtureDir: json['fixtureDir'] as String?,
    text: json['text'] as String?,
    confirmed: json['confirmed'] as bool? ?? true,
    budgetBytes: json['budgetBytes'] as int?,
  );

  /// 读取作业文件。
  static WorkerJob read(String path) {
    final Object? decoded = jsonDecode(File(path).readAsStringSync());
    if (decoded is! Map<String, Object?>) {
      throw const FormatException('worker job 必须是 JSON 对象');
    }
    return fromJson(decoded);
  }

  /// 写入作业文件（覆盖）。
  Future<void> write(String path) async {
    final File file = File(path);
    await file.parent.create(recursive: true);
    await file.writeAsString(jsonEncode(toJson()), flush: true);
  }
}
