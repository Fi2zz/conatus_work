/// 撤销点的落盘：`undo` 写，`redo` 读并清除。
///
/// 存在即表示「这个运行可以重做」。放在独立文件而不是 `run.json` 里：
/// 撤销点是操作状态，不是运行结果；redo 成功后整份删掉，语义清楚。
library;

import 'dart:convert';
import 'dart:io';

import 'package:conatus_checkpoint/revert.dart';

import 'run_paths.dart';

/// `var/runs/<runId>/revert-stage.json` 的读写。
class RevertStageStore {
  RevertStageStore(this.paths);

  /// 运行目录布局。
  final RunPaths paths;

  /// 撤销点文件的位置。
  String get filePath =>
      '${paths.runDir}${Platform.pathSeparator}revert-stage.json';

  /// 读取撤销点；没有则返回 null。
  RevertStage? load() {
    final File file = File(filePath);
    if (!file.existsSync()) return null;
    try {
      final Object? decoded = jsonDecode(file.readAsStringSync());
      if (decoded is! Map<String, Object?>) return null;
      return RevertStage(
        originalSessionId: decoded['originalSessionId'] as String,
        forkSessionId: decoded['forkSessionId'] as String,
        fromTurn: decoded['fromTurn'] as int,
        toTurn: decoded['toTurn'] as int,
        prompt: decoded['prompt'] as String? ?? '',
      );
    } on FormatException {
      return null;
    } on TypeError {
      return null;
    }
  }

  /// 写入撤销点（覆盖旧值）。
  Future<void> save(RevertStage stage) async {
    await File(filePath).writeAsString(
      jsonEncode(<String, Object?>{
        'originalSessionId': stage.originalSessionId,
        'forkSessionId': stage.forkSessionId,
        'fromTurn': stage.fromTurn,
        'toTurn': stage.toTurn,
        'prompt': stage.prompt,
      }),
    );
  }

  /// 清除撤销点。
  Future<void> clear() async {
    final File file = File(filePath);
    if (file.existsSync()) await file.delete();
  }
}
