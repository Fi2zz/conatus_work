/// 运行目录布局与 `runId` 生成。
library;

import 'dart:io';
import 'dart:math';

/// 生成 `run_<yyyyMMdd-HHmmss>-<4 hex>` 形式的运行标识。
String newRunId(DateTime now, [Random? random]) {
  final String stamp = '${_pad(now.year, 4)}${_pad(now.month, 2)}'
      '${_pad(now.day, 2)}-${_pad(now.hour, 2)}${_pad(now.minute, 2)}'
      '${_pad(now.second, 2)}';
  final int suffix = (random ?? Random()).nextInt(0x10000);
  return 'run_$stamp-${suffix.toRadixString(16).padLeft(4, '0')}';
}

String _pad(int value, int width) => value.toString().padLeft(width, '0');

/// `var/runs/<runId>/` 下的固定路径。
class RunPaths {
  RunPaths({required this.runsDir, required this.runId});

  /// `var/runs` 的绝对或相对位置。
  final String runsDir;

  /// 本次运行的标识。
  final String runId;

  String get runDir => '$runsDir${Platform.pathSeparator}$runId';

  String get runJsonPath => '$runDir${Platform.pathSeparator}run.json';

  String get eventsPath => '$runDir${Platform.pathSeparator}events.jsonl';

  String get artifactsDir => '$runDir${Platform.pathSeparator}artifacts';

  String get abortFlagPath => '$runDir${Platform.pathSeparator}abort.request';

  /// 建立运行目录（含 `artifacts/`）。
  Future<void> create() => Directory(artifactsDir).create(recursive: true);
}
