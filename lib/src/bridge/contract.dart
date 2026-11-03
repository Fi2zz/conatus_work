/// 桥接契约的 Dart 侧模型。JSON 键与 `ui/src/bridge/types.ts` 完全一致。
library;

/// 一次运行的摘要，对应 TS 的 `RunSummary`。
class RunSummary {
  RunSummary({
    required this.id,
    required this.taskId,
    required this.title,
    required this.chain,
    required this.status,
    required this.model,
    required this.startedAt,
    required this.usage,
    this.endedAt,
    this.synthetic = false,
  });

  final String id;
  final String taskId;
  final String title;
  final String chain;
  final String status;
  final String model;
  final String startedAt;
  final String? endedAt;
  final Map<String, Object?> usage;
  final bool synthetic;

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'taskId': taskId,
    'title': title,
    'chain': chain,
    'status': status,
    'model': model,
    'startedAt': startedAt,
    if (endedAt != null) 'endedAt': endedAt,
    'usage': usage,
    if (synthetic) 'synthetic': true,
  };
}

/// 回放 fixture：React 侧 `ReplayFixture` 的对等物。
class RunFixture {
  RunFixture({
    required this.run,
    required this.events,
    required this.artifacts,
    required this.files,
    required this.changes,
    required this.checkpoints,
  });

  final Map<String, Object?> run;
  final List<Map<String, Object?>> events;
  final List<Map<String, Object?>> artifacts;
  final Map<String, String> files;
  final Map<String, Object?>? changes;
  final Map<String, Object?> checkpoints;

  Map<String, Object?> toJson() => <String, Object?>{
    'schemaVersion': 1,
    'run': run,
    'events': events,
    'artifacts': artifacts,
    'files': files,
    'changes': changes,
    'checkpoints': checkpoints,
  };
}
