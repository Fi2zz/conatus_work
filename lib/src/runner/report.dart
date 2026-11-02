/// 运行记录汇总：按链统计成功率、救场率与产物通过率。
library;

import 'run_store.dart';

/// 渲染汇总表；每链一行，末尾一行总计。
String renderReport(Iterable<RunRecord> records) {
  final Map<String, List<RunRecord>> byChain = <String, List<RunRecord>>{};
  for (final RunRecord record in records) {
    byChain.putIfAbsent(record.chain, () => <RunRecord>[]).add(record);
  }
  final List<String> chains = byChain.keys.toList()..sort();
  final List<String> lines = <String>[
    for (final String chain in chains) _row(chain, byChain[chain]!),
    _row('total', records.toList()),
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
      '\tartifactRate=${_percent(passed, artifacts.length)}%';
}

bool _rescued(RunRecord record) =>
    record.humanEdits.isNotEmpty || record.rerunOf != null;

String _percent(int part, int whole) =>
    whole == 0 ? '100.0' : (part * 100 / whole).toStringAsFixed(1);
