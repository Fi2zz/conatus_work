/// 运行记录的数据类型：`run.json` 的字段与 JSON 投影。
library;

/// 一次运行的最终状态。
enum RunStatus { running, succeeded, failed, aborted }

/// 失败分类；`null` 表示没有失败。
enum FailureCategory { artifact, llm, tool, timeout, budget, checkpoint, internal }

/// 检查点收口状态。
enum CheckpointStatus { pending, ok, error }

/// 单个期望产物的机检结果。
class ArtifactCheck {
  ArtifactCheck({
    required this.path,
    this.bytes = 0,
    this.sha256 = '',
    this.passed = false,
    this.reason,
  });

  /// 产物相对路径。
  String path;

  /// 字节数。
  int bytes;

  /// 内容的 sha256。
  String sha256;

  /// 是否通过。
  bool passed;

  /// 未通过原因：`missing` / `empty` / `notFile`。
  String? reason;

  Map<String, Object?> toJson() => <String, Object?>{
        'path': path,
        'bytes': bytes,
        'sha256': sha256,
        'check': <String, Object?>{'passed': passed, 'reason': reason},
      };

  static ArtifactCheck fromJson(Map<String, Object?> json) {
    final Map<String, Object?> check = _map(json['check']);
    return ArtifactCheck(
      path: json['path'] as String? ?? '',
      bytes: json['bytes'] as int? ?? 0,
      sha256: json['sha256'] as String? ?? '',
      passed: check['passed'] as bool? ?? false,
      reason: check['reason'] as String?,
    );
  }
}

/// 人工救场记录。
class HumanEdit {
  HumanEdit({
    required this.at,
    required this.artifact,
    required this.note,
    this.sha256,
  });

  /// 记录时间。
  DateTime at;

  /// 被人工改动的产物。
  String artifact;

  /// 改动说明。
  String note;

  /// 记录时该产物的 sha256。
  String? sha256;

  Map<String, Object?> toJson() => <String, Object?>{
        'at': at.toIso8601String(),
        'artifact': artifact,
        'note': note,
        'sha256': sha256,
      };

  static HumanEdit fromJson(Map<String, Object?> json) => HumanEdit(
        at: DateTime.parse(json['at'] as String? ?? '1970-01-01T00:00:00Z'),
        artifact: json['artifact'] as String? ?? '',
        note: json['note'] as String? ?? '',
        sha256: json['sha256'] as String?,
      );
}

/// 失败分类与消息。
class RunFailure {
  RunFailure({this.category, this.message});

  FailureCategory? category;
  String? message;

  Map<String, Object?> toJson() => <String, Object?>{
        'category': category?.name,
        'message': message,
      };

  static RunFailure fromJson(Map<String, Object?> json) {
    final String? name = json['category'] as String?;
    return RunFailure(
      category: name == null ? null : FailureCategory.values.byName(name),
      message: json['message'] as String?,
    );
  }
}

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
  RunStatus status = RunStatus.running;
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
        'startedAt': startedAt.toIso8601String(),
        'endedAt': endedAt?.toIso8601String(),
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
    final Map<String, Object?> turns = _map(json['turns']);
    final Map<String, Object?> checkpoint = _map(json['checkpoint']);
    final Map<String, Object?> usage = _map(json['usage']);
    final RunRecord record = RunRecord(
      runId: json['runId'] as String? ?? '',
      taskId: json['taskId'] as String? ?? '',
      chain: json['chain'] as String? ?? '',
      taskPath: json['taskPath'] as String? ?? '',
      workspaceRoot: json['workspaceRoot'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      pid: json['pid'] as int? ?? 0,
      startedAt:
          DateTime.parse(json['startedAt'] as String? ?? '1970-01-01T00:00:00Z'),
    );
    record
      ..endedAt = _date(json['endedAt'])
      ..status = RunStatus.values.byName(json['status'] as String? ?? 'running')
      ..model = json['model'] as String?
      ..resumeCount = json['resumeCount'] as int? ?? 0
      ..rerunOf = json['rerunOf'] as String?
      ..startTurn = turns['start'] as int?
      ..endTurn = turns['end'] as int?
      ..checkpointStatus = CheckpointStatus.values
          .byName(checkpoint['status'] as String? ?? 'pending')
      ..checkpointError = checkpoint['error'] as String?
      ..inputTokens = usage['inputTokens'] as int? ?? 0
      ..outputTokens = usage['outputTokens'] as int? ?? 0
      ..costUsd = (usage['costUsd'] as num? ?? 0).toDouble()
      ..artifacts = <ArtifactCheck>[
        for (final Object? item in _list(json['artifacts']))
          ArtifactCheck.fromJson(_map(item)),
      ]
      ..tools = <String>[
        for (final Object? item in _list(json['tools']))
          if (item is String) item,
      ]
      ..forkSessionId = json['forkSessionId'] as String?
      ..humanEdits = <HumanEdit>[
        for (final Object? item in _list(json['humanEdits']))
          HumanEdit.fromJson(_map(item)),
      ]
      ..failure = RunFailure.fromJson(_map(json['failure']));
    return record;
  }
}

Map<String, Object?> _map(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

List<Object?> _list(Object? value) =>
    value is List<Object?> ? value : const <Object?>[];

DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
