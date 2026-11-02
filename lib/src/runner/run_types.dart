/// 运行记录本体：`run.json` 的字段与 JSON 投影。
library;

import 'json_value.dart';
import 'run_models.dart';

export 'run_models.dart';

/// 一次运行的最终状态。
enum TaskRunStatus { running, succeeded, failed, aborted }

/// 检查点收口状态。
enum CheckpointStatus { pending, ok, error }

/// 一次运行的完整记录（`run.json`）。
class RunRecord {
  RunRecord({
    required this.runId,
    required this.taskId,
    required this.chain,
    required this.taskPath,
    required this.workspaceRoot,
    required this.sessionId,
    required this.pid,
    required this.startedAt,
  });

  String runId;
  String taskId;
  String chain;
  String taskPath;
  String workspaceRoot;
  String sessionId;
  int pid;
  DateTime startedAt;
  DateTime? endedAt;
  TaskRunStatus status = TaskRunStatus.running;
  String? model;
  int resumeCount = 0;
  String? rerunOf;
  int? startTurn;
  int? endTurn;
  CheckpointStatus checkpointStatus = CheckpointStatus.pending;
  String? checkpointError;
  int inputTokens = 0;
  int outputTokens = 0;
  double costUsd = 0;
  List<ArtifactCheck> artifacts = <ArtifactCheck>[];
  List<String> tools = <String>[];
  String? forkSessionId;
  List<HumanEdit> humanEdits = <HumanEdit>[];
  RunFailure failure = RunFailure();

  Map<String, Object?> toJson() => <String, Object?>{
    'runId': runId,
    'taskId': taskId,
    'chain': chain,
    'taskPath': taskPath,
    'workspaceRoot': workspaceRoot,
    'pid': pid,
    'sessionId': sessionId,
    'startedAt': isoWithOffset(startedAt),
    'endedAt': endedAt == null ? null : isoWithOffset(endedAt!),
    'status': status.name,
    'model': model,
    'resumeCount': resumeCount,
    'rerunOf': rerunOf,
    'turns': <String, Object?>{'start': startTurn, 'end': endTurn},
    'checkpoint': <String, Object?>{
      'status': checkpointStatus.name,
      'error': checkpointError,
    },
    'usage': <String, Object?>{
      'inputTokens': inputTokens,
      'outputTokens': outputTokens,
      'costUsd': costUsd,
    },
    'artifacts': <Object?>[for (final ArtifactCheck a in artifacts) a.toJson()],
    'tools': tools,
    'forkSessionId': forkSessionId,
    'humanEdits': <Object?>[for (final HumanEdit e in humanEdits) e.toJson()],
    'failure': failure.toJson(),
  };

  static RunRecord fromJson(Map<String, Object?> json) {
    final RunRecord record = RunRecord(
      runId: json['runId'] as String? ?? '',
      taskId: json['taskId'] as String? ?? '',
      chain: json['chain'] as String? ?? '',
      taskPath: json['taskPath'] as String? ?? '',
      workspaceRoot: json['workspaceRoot'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      pid: json['pid'] as int? ?? 0,
      startedAt: DateTime.parse(
        json['startedAt'] as String? ?? '1970-01-01T00:00:00Z',
      ),
    );
    _applyScalars(record, json);
    _applyCollections(record, json);
    return record;
  }

  static void _applyScalars(RunRecord record, Map<String, Object?> json) {
    final Map<String, Object?> turns = asJsonMap(json['turns']);
    final Map<String, Object?> checkpoint = asJsonMap(json['checkpoint']);
    final Map<String, Object?> usage = asJsonMap(json['usage']);
    record
      ..endedAt = asJsonDate(json['endedAt'])
      ..status = TaskRunStatus.values.byName(
        json['status'] as String? ?? 'running',
      )
      ..model = json['model'] as String?
      ..resumeCount = json['resumeCount'] as int? ?? 0
      ..rerunOf = json['rerunOf'] as String?
      ..startTurn = turns['start'] as int?
      ..endTurn = turns['end'] as int?
      ..checkpointStatus = CheckpointStatus.values.byName(
        checkpoint['status'] as String? ?? 'pending',
      )
      ..checkpointError = checkpoint['error'] as String?
      ..inputTokens = usage['inputTokens'] as int? ?? 0
      ..outputTokens = usage['outputTokens'] as int? ?? 0
      ..costUsd = (usage['costUsd'] as num? ?? 0).toDouble()
      ..forkSessionId = json['forkSessionId'] as String?;
  }

  static void _applyCollections(RunRecord record, Map<String, Object?> json) {
    record
      ..artifacts = <ArtifactCheck>[
        for (final Object? item in asJsonList(json['artifacts']))
          ArtifactCheck.fromJson(asJsonMap(item)),
      ]
      ..tools = <String>[
        for (final Object? item in asJsonList(json['tools']))
          if (item is String) item,
      ]
      ..humanEdits = <HumanEdit>[
        for (final Object? item in asJsonList(json['humanEdits']))
          HumanEdit.fromJson(asJsonMap(item)),
      ]
      ..failure = RunFailure.fromJson(asJsonMap(json['failure']));
  }
}
