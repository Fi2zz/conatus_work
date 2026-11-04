/// 运行目录 → 回放 fixture。规则与 `ui/tools/lib/fixture-build.mjs` 对齐。
library;

import 'dart:io';

import 'contract.dart';
import 'projection_events.dart';
import 'projection_io.dart';
import 'projection_payload.dart';

export 'contract.dart';

/// 读取一个运行目录并投影成 [RunFixture]。
///
/// 目录内若有 `workspace/`，产物正文与变更集从该目录读取，输出里
/// `workspaceRoot` 记逻辑路径 `workspace`——fixture 输入自包含且与机器无关。
RunFixture projectRunDir(String runDir) {
  final Map<String, Object?>? run = readJsonObject('$runDir/run.json');
  if (run == null) throw StateError('缺少 run.json: $runDir');
  final Map<String, Object?>? card =
      readJsonObject('$runDir/task.json') ??
      readJsonObject(
        run['taskPath'] is String ? run['taskPath']! as String : '',
      );
  final List<Map<String, Object?>> rawEvents = readJsonLines(
    _sessionPath(runDir, run['forkSessionId'] ?? run['sessionId']),
  );

  final bool bundled = Directory('$runDir/workspace').existsSync();
  final String workspaceRoot = bundled
      ? '$runDir/workspace'
      : (run['workspaceRoot'] is String ? run['workspaceRoot']! as String : '');

  final String startedAt = run['startedAt'] is String
      ? run['startedAt']! as String
      : '';
  final Object? endedAt = run['endedAt'];
  final int base = epochMs(startedAt) ?? 0;
  final int endMs = epochMs(endedAt) ?? base;
  final int endAt = endMs - base < 0 ? 0 : endMs - base;

  final List<Map<String, Object?>> events = buildEventStream(
    rawEvents,
    startedAt,
  );
  final ArtifactPayload payload = buildArtifactViews(
    workspaceRoot,
    _list(run['artifacts']),
  );
  final Map<String, Object?>? changes = buildChanges(workspaceRoot, rawEvents);

  final Map<String, Object?> turns = run['turns'] is Map<String, Object?>
      ? run['turns']! as Map<String, Object?>
      : <String, Object?>{};

  final int startTurn = (turns['start'] as num?)?.toInt() ?? 0;
  final int currentTurn = (turns['end'] as num?)?.toInt() ?? startTurn;

  for (final Map<String, Object?> view in payload.views) {
    events.add(<String, Object?>{
      'seq': events.length,
      'at': endAt,
      'type': 'artifact/added',
      'data': view,
    });
  }
  if (changes != null) {
    events.add(<String, Object?>{
      'seq': events.length,
      'at': endAt,
      'type': 'changes/updated',
      'data': changes,
    });
  }
  if (currentTurn > startTurn) {
    events.add(<String, Object?>{
      'seq': events.length,
      'at': endAt,
      'type': 'checkpoint/recorded',
      'data': <String, Object?>{
        'turn': currentTurn,
        'startTurn': startTurn,
        'at': endedAt is String ? endedAt : startedAt,
        'eventCount': events.length,
      },
    });
  }
  events.add(<String, Object?>{
    'seq': events.length,
    'at': endAt,
    'type': 'usage/updated',
    'data': _map(run['usage']),
  });
  events.add(<String, Object?>{
    'seq': events.length,
    'at': endAt,
    'type': 'task/ended',
    'data': <String, Object?>{
      'status': run['status'],
      'endedAt': endedAt is String ? endedAt : startedAt,
      'failure':
          run['failure'] ??
          <String, Object?>{'category': null, 'message': null},
    },
  });

  return RunFixture(
    run: <String, Object?>{
      'id': run['runId'],
      'taskId': run['taskId'],
      'title': card?['title'] ?? run['taskId'],
      'chain': run['chain'],
      'status': run['status'],
      'model': run['model'],
      'startedAt': startedAt,
      if (endedAt is String) 'endedAt': endedAt,
      'usage': _map(run['usage']),
      'workspaceRoot': bundled ? 'workspace' : workspaceRoot,
      'synthetic': false,
    },
    events: events,
    artifacts: payload.views,
    files: payload.files,
    changes: changes,
    checkpoints: buildCheckpointView(run, card),
  );
}

Map<String, Object?> _map(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

String _sessionPath(String runDir, Object? sessionId) {
  final String id = sessionId is String && sessionId.isNotEmpty
      ? sessionId
      : 'events';
  final String candidate = '$runDir/$id.jsonl';
  return File(candidate).existsSync() ? candidate : '$runDir/events.jsonl';
}

List<Object?> _list(Object? value) =>
    value is List<Object?> ? value : <Object?>[];
