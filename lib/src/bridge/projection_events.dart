/// 会话日志到桥接事件的投影。规则与 `ui/tools/lib/events.mjs` 逐条对齐。
library;

import 'projection_io.dart';

/// 把原始 `events.jsonl` 条目投影成桥接事件，并按 `(at, 原序)` 重排后重新编号。
List<Map<String, Object?>> buildEventStream(
  List<Map<String, Object?>> rawEvents,
  String startedAt,
) {
  final int base = epochMs(startedAt) ?? 0;
  final List<Map<String, Object?>> out = <Map<String, Object?>>[];
  final Map<String, int> startedCallAt = <String, int>{};
  int seq = 0;

  for (final Map<String, Object?> event in rawEvents) {
    final int at = _offsetOf(event['time'], base);

    if (event['type'] == 'user/message') {
      out.add(<String, Object?>{
        'seq': seq++,
        'at': at,
        'type': 'message/user',
        'data': <String, Object?>{'text': _text(event['data'], 'text')},
      });
      continue;
    }

    if (event['type'] == 'assistant/message') {
      seq += 1;
      final Object? id = event['id'];
      out.add(<String, Object?>{
        'seq': seq - 1,
        'at': at,
        'type': 'message/assistant/done',
        'data': <String, Object?>{
          'entryId': id is String && id.isNotEmpty ? id : 'assistant-$seq',
          'text': _text(event['data'], 'text'),
          if (_hasText(event['data'], 'reasoning'))
            'reasoning': _text(event['data'], 'reasoning'),
        },
      });
      final Map<String, Object?> data = _mapOf(event['data']);
      for (final Object? call in _listOf(data['toolCalls'])) {
        final Map<String, Object?> tool = _mapOf(call);
        final String callId = tool['id'] is String ? tool['id']! as String : '';
        startedCallAt[callId] = at;
        out.add(<String, Object?>{
          'seq': seq++,
          'at': at,
          'type': 'tool/started',
          'data': <String, Object?>{
            'callId': callId,
            'name': tool['name'] ?? 'unknown',
            'args': tool['arguments'] ?? '{}',
          },
        });
      }
      continue;
    }

    if (event['type'] == 'tool/result') {
      final Map<String, Object?> data = _mapOf(event['data']);
      final String callId = data['callId'] is String ? data['callId']! as String : 'call-${seq + 1}';
      final int startedAtMs = startedCallAt[callId] ?? at;
      final String content = data['content'] is String ? data['content']! as String : '';
      seq += 1;
      out.add(<String, Object?>{
        'seq': seq - 1,
        'at': at,
        'type': 'tool/finished',
        'data': <String, Object?>{
          'callId': callId,
          'name': data['name'] ?? 'unknown',
          'ok': data['isError'] != true,
          'summary': firstLine(content),
          'content': clipContent(content),
          'durationMs': at - startedAtMs < 0 ? 0 : at - startedAtMs,
        },
      });
    }
  }

  final List<MapEntry<int, Map<String, Object?>>> indexed =
      <MapEntry<int, Map<String, Object?>>>[
        for (int i = 0; i < out.length; i += 1) MapEntry<int, Map<String, Object?>>(i, out[i]),
      ];
  indexed.sort((MapEntry<int, Map<String, Object?>> a, MapEntry<int, Map<String, Object?>> b) {
    final int byAt = (a.value['at']! as int).compareTo(b.value['at']! as int);
    return byAt != 0 ? byAt : a.key.compareTo(b.key);
  });

  return <Map<String, Object?>>[
    for (int i = 0; i < indexed.length; i += 1)
      <String, Object?>{...indexed[i].value, 'seq': i},
  ];
}

/// 摘要行：取第一行非空文本，超过 120 字符截断。
String firstLine(String text) {
  final String line = text.split('\n').firstWhere(
    (String candidate) => candidate.trim().isNotEmpty,
    orElse: () => '',
  );
  return line.length > 120 ? '${line.substring(0, 117)}…' : line;
}

/// 工具输出正文：超过 2000 字符截断。
String clipContent(String text) => text.length > 2000 ? '${text.substring(0, 2000)}…' : text;

int _offsetOf(Object? time, int base) {
  final int parsed = epochMs(time) ?? base;
  final int delta = parsed - base;
  return delta < 0 ? 0 : delta;
}

Map<String, Object?> _mapOf(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

List<Object?> _listOf(Object? value) => value is List<Object?> ? value : <Object?>[];

String _text(Object? data, String key) {
  final Object? value = _mapOf(data)[key];
  return value is String ? value : '';
}

bool _hasText(Object? data, String key) {
  final Object? value = _mapOf(data)[key];
  return value is String && value.isNotEmpty;
}
