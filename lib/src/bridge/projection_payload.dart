/// 产物正文与变更集的投影。规则与 `ui/tools/lib/artifacts.mjs` / `changes.mjs` 对齐。
library;

import 'dart:convert';

import 'projection_io.dart';

const int _maxInlineBytes = 64 * 1024;

class ArtifactPayload {
  ArtifactPayload(this.views, this.files);

  final List<Map<String, Object?>> views;
  final Map<String, String> files;
}

ArtifactPayload buildArtifactViews(
  String workspaceRoot,
  List<Object?> artifacts,
) {
  final Map<String, String> files = <String, String>{};
  final List<Map<String, Object?>> views = <Map<String, Object?>>[];
  for (final Object? item in artifacts) {
    final Map<String, Object?> artifact = item is Map<String, Object?>
        ? item
        : <String, Object?>{};
    final String path = artifact['path'] is String
        ? artifact['path']! as String
        : '';
    final Map<String, Object?> view = <String, Object?>{
      'path': path,
      'bytes': (artifact['bytes'] as num?)?.toInt() ?? 0,
      'sha256': artifact['sha256'] is String ? artifact['sha256'] : '',
      'check':
          artifact['check'] ??
          <String, Object?>{
            'exists': true,
            'nonEmpty': true,
            'passed': true,
            'reason': null,
          },
    };
    final String? content = readTextFile('$workspaceRoot/$path');
    if (content != null) {
      final List<int> bytes = utf8.encode(content);
      final bool truncated = bytes.length > _maxInlineBytes;
      files[path] = truncated
          ? utf8.decode(bytes.sublist(0, _maxInlineBytes), allowMalformed: true)
          : content;
      if (truncated) view['truncated'] = true;
    }
    views.add(view);
  }
  return ArtifactPayload(views, files);
}

/// 变更集：优先 `out/changes.json`，其次从 `move` 工具结果反推，都缺则为 null。
Map<String, Object?>? buildChanges(
  String workspaceRoot,
  List<Map<String, Object?>> rawEvents,
) {
  final Map<String, Object?>? recorded = readJsonObject(
    '$workspaceRoot/out/changes.json',
  );
  final Map<String, Object?>? fromRecord = _fromRecorded(recorded);
  if (fromRecord != null) return fromRecord;
  return _fromMoveResults(rawEvents);
}

Map<String, Object?>? _fromRecorded(Map<String, Object?>? recorded) {
  final Object? operations = recorded?['operations'];
  if (recorded == null || operations is! List<Object?>) return null;
  final Map<String, Object?> summary =
      recorded['summary'] is Map<String, Object?>
      ? recorded['summary']! as Map<String, Object?>
      : <String, Object?>{};
  final Object? quarantined = summary['quarantined'];
  return <String, Object?>{
    'summary': <String, Object?>{
      'added': (summary['added'] as num?)?.toInt() ?? 0,
      'modified': (summary['modified'] as num?)?.toInt() ?? 0,
      'moved': (summary['moved'] as num?)?.toInt() ?? operations.length,
      'deleted': (summary['deleted'] as num?)?.toInt() ?? 0,
      if (quarantined is num && quarantined != 0)
        'quarantined': quarantined.toInt(),
    },
    'files': <Object?>[
      for (final Object? operation in operations)
        if (_validOperation(operation))
          _changeFile(operation! as Map<String, Object?>),
    ],
  };
}

Map<String, Object?>? _fromMoveResults(List<Map<String, Object?>> rawEvents) {
  final List<Map<String, Object?>> derived = <Map<String, Object?>>[];
  for (final Map<String, Object?> event in rawEvents) {
    if (event['type'] != 'tool/result') continue;
    final Map<String, Object?> data = event['data'] is Map<String, Object?>
        ? event['data']! as Map<String, Object?>
        : <String, Object?>{};
    if (data['name'] != 'move' || data['isError'] == true) continue;
    final Map<String, Object?>? parsed =
        _parseJson(data['content']) ?? _parseMoveText(data['content']);
    if (parsed == null) continue;
    final Object? operations = parsed['operations'];
    if (operations is List<Object?>) {
      for (final Object? item in operations) {
        if (item is Map<String, Object?>) derived.add(item);
      }
    } else if (_validOperation(parsed)) {
      derived.add(parsed);
    }
  }
  if (derived.isEmpty) return null;
  return <String, Object?>{
    'summary': <String, Object?>{
      'added': 0,
      'modified': 0,
      'moved': derived.length,
      'deleted': 0,
    },
    'files': <Object?>[
      for (final Map<String, Object?> item in derived) _changeFile(item),
    ],
  };
}

Map<String, Object?> _changeFile(Map<String, Object?> operation) {
  final Object? reason = operation['reason'];
  return <String, Object?>{
    'from': operation['from'],
    'to': operation['to'],
    'sha256': operation['sha256'] is String ? operation['sha256'] : '',
    if (reason is String && reason.isNotEmpty) 'reason': reason,
  };
}

bool _validOperation(Object? operation) {
  if (operation is! Map<String, Object?>) return false;
  final Object? from = operation['from'];
  final Object? to = operation['to'];
  return from is String && from.isNotEmpty && to is String && to.isNotEmpty;
}

Map<String, Object?>? _parseJson(Object? text) {
  if (text is! String) return null;
  try {
    final Object? decoded = jsonDecode(text);
    return decoded is Map<String, Object?> ? decoded : null;
  } on FormatException {
    return null;
  }
}

final RegExp _movePattern = RegExp(
  r'已移动：(.+?)\s*→\s*(.+?)（[^）]*?sha256=([0-9a-f]{64})',
);

Map<String, Object?> buildCheckpointView(
  Map<String, Object?> run,
  Map<String, Object?>? card,
) {
  final Map<String, Object?> turns = _map(run['turns']);
  final int startTurn = (turns['start'] as num?)?.toInt() ?? 0;
  final int currentTurn = (turns['end'] as num?)?.toInt() ?? startTurn;
  final Map<String, Object?> checkpoint = _map(card?['checkpoint']);
  final int keep = (checkpoint['keep'] as num?)?.toInt() ?? 5;
  final Map<int, Map<String, Object?>> byTurn = <int, Map<String, Object?>>{};
  for (final Object? item in _list(run['turnHistory'])) {
    final Map<String, Object?> entry = _map(item);
    final int? turn = (entry['turn'] as num?)?.toInt();
    if (turn == null) continue;
    byTurn[turn] = <String, Object?>{
      'turn': turn,
      'at': entry['at'],
      'eventCount': (entry['eventCount'] as num?)?.toInt() ?? 0,
    };
  }
  final List<int> turnNumbers = byTurn.keys.toList()..sort();
  final List<Object?> views = <Object?>[];
  final List<int> gaps = <int>[];
  int? previous;
  for (final int turn in turnNumbers) {
    if (previous != null) {
      for (int missing = previous + 1; missing < turn; missing += 1) {
        gaps.add(missing);
      }
    }
    views.add(byTurn[turn]!);
    previous = turn;
  }
  return <String, Object?>{
    'startTurn': startTurn,
    'currentTurn': currentTurn,
    'keep': keep,
    'turns': views,
    'gaps': gaps,
  };
}

Map<String, Object?> _map(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

List<Object?> _list(Object? value) =>
    value is List<Object?> ? value : <Object?>[];

Map<String, Object?>? _parseMoveText(Object? text) {
  if (text is! String) return null;
  final RegExpMatch? match = _movePattern.firstMatch(text);
  if (match == null) return null;
  return <String, Object?>{
    'from': match.group(1)!.trim(),
    'to': match.group(2)!.trim(),
    'sha256': match.group(3),
  };
}
