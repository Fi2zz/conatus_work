/// 运行记录汇总：按链统计成功率、救场率与产物通过率。
library;

import 'run_store.dart';

/// 渲染汇总表；每链一行，末尾一行总计。
String renderReport(Iterable<RunRecord> records) {
  final List<RunRecord> latest = _latestPerTask(records);
  final Map<String, List<RunRecord>> byChain = <String, List<RunRecord>>{};
  for (final RunRecord record in latest) {
    byChain.putIfAbsent(record.chain, () => <RunRecord>[]).add(record);
  }
  final List<String> chains = byChain.keys.toList()..sort();
  final List<String> lines = <String>[
    for (final String chain in chains) _row(chain, byChain[chain]!),
    _row('total', latest),
    _failureLine(records),
    _rescueLine(latest),
  ];
  return lines.join('\n');
}

String _row(String chain, List<RunRecord> rows) {
  final int total = rows.length;
  final int succeeded = rows
      .where((RunRecord r) => r.status == TaskRunStatus.succeeded)
      .length;
  final int failed = rows
      .where((RunRecord r) => r.status == TaskRunStatus.failed)
      .length;
  final int aborted = rows
      .where((RunRecord r) => r.status == TaskRunStatus.aborted)
      .length;
  final int rescued = rows.where(_rescued).length;
  final List<ArtifactCheck> artifacts = <ArtifactCheck>[
    for (final RunRecord r in rows) ...r.artifacts,
  ];
  final int passed = artifacts.where((ArtifactCheck a) => a.passed).length;
  return '$chain\ttotal=$total\tsucceeded=$succeeded/$total\tfailed=$failed'
      '\taborted=$aborted\trescued=$rescued'
      '\trescueRate=${_percent(rescued, total)}%'
      '\tartifactRate=${_percent(passed, artifacts.length)}%'
      '\tp50=${_minutes(_percentile(rows, 0.5))}'
      '\tp95=${_minutes(_percentile(rows, 0.95))}'
      '${_usageColumns(rows)}';
}

String _usageColumns(List<RunRecord> rows) {
  int inputTokens = 0;
  int outputTokens = 0;
  double costUsd = 0;
  int undoOk = 0;
  int undoFailed = 0;
  int undoDamage = 0;
  int redo = 0;
  int redoFailed = 0;
  for (final RunRecord record in rows) {
    inputTokens += record.inputTokens;
    outputTokens += record.outputTokens;
    costUsd += record.costUsd;
    undoOk += record.undoCount;
    undoFailed += record.undoFailureCount;
    undoDamage += record.undoDamage;
    redo += record.redoCount;
    redoFailed += record.redoFailureCount;
  }
  return '\ttokensIn=$inputTokens\ttokensOut=$outputTokens'
      '\tcostUsd=${costUsd.toStringAsFixed(4)}'
      '\tundo=ok:$undoOk,failed:$undoFailed,damage:$undoDamage,redo:$redo,redoFailed:$redoFailed';
}

/// 同一任务多次尝试只保留最近一次：任务数按任务卡算，不按进程算。
List<RunRecord> _latestPerTask(Iterable<RunRecord> records) {
  final Map<String, RunRecord> byTask = <String, RunRecord>{};
  for (final RunRecord record in records) {
    final RunRecord? previous = byTask[record.taskId];
    if (previous == null || record.startedAt.isAfter(previous.startedAt)) {
      byTask[record.taskId] = record;
    }
  }
  return byTask.values.toList();
}

/// 最近一次运行的耗时（分钟），缺失按 0 计。
double _duration(RunRecord record) {
  final DateTime? ended = record.endedAt;
  if (ended == null) return 0;
  final double minutes = ended.difference(record.startedAt).inSeconds / 60;
  return minutes < 0 ? 0 : minutes;
}

double _percentile(List<RunRecord> rows, double p) {
  if (rows.isEmpty) return 0;
  final List<double> values = <double>[
    for (final RunRecord r in rows) _duration(r),
  ]..sort();
  // 最近秩法：p50 取较小者，p95 取最大者。
  final int index = (p * values.length).ceil() - 1;
  return values[index.clamp(0, values.length - 1)];
}

String _minutes(double value) => '${value.toStringAsFixed(1)}min';

String _failureLine(Iterable<RunRecord> records) {
  final Map<String, int> counts = <String, int>{};
  for (final RunRecord record in records) {
    final String? category = record.failure.category?.name;
    if (category == null) continue;
    counts[category] = (counts[category] ?? 0) + 1;
  }
  final List<String> keys = counts.keys.toList()..sort();
  final String body = keys.isEmpty
      ? 'none:0'
      : keys.map((k) => '$k:${counts[k]}').join(',');
  return 'failures=$body';
}

String _rescueLine(Iterable<RunRecord> latest) {
  int rerun = 0;
  int human = 0;
  int tasks = 0;
  for (final RunRecord record in latest) {
    tasks += 1;
    if (record.rerunOf != null) rerun += 1;
    if (record.humanEdits.isNotEmpty) human += 1;
  }
  return 'rescuedBy=rerun:$rerun,human:$human (tasks=$tasks)';
}

bool _rescued(RunRecord record) =>
    record.humanEdits.isNotEmpty || record.rerunOf != null;

String _percent(int part, int whole) =>
    whole == 0 ? '100.0' : (part * 100 / whole).toStringAsFixed(1);
