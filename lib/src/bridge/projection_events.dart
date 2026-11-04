/// 会话日志到桥接事件的投影。规则与 `ui/tools/lib/events.mjs` 逐条对齐。
library;

import 'projection_io.dart';

/// 把原始会话事件逐条映射成桥接事件。
///
/// 有状态：记录每个工具调用的开始时间与自增 `seq`，所以同一个实例要按顺序喂事件。
/// 投影（一次性读全量）与运行期尾随（增量读）共用它，避免两套映射漂移。
class EventMapper {
  EventMapper(this.startedAt, {int startSeq = 0}) : _seq = startSeq;

  /// 运行开始时间（ISO 字符串），用来算毫秒偏移。
  final String startedAt;

  int _seq;
  String? _streamEntryId;
  final List<String> _streamQueue = <String>[];
  final Map<String, int> _startedCallAt = <String, int>{};

  int get seq => _seq;

  /// 产出一条流式正文增量；同一轮内复用 entryId，最终消息会沿用。
  Map<String, Object?> emitDelta(String text) {
    final String entryId = _streamEntryId ??= 'assistant-stream-$_seq';
    if (!_streamQueue.contains(entryId)) _streamQueue.add(entryId);
    return <String, Object?>{
      'seq': _seq++,
      'at': _nowOffset(),
      'type': 'message/assistant/delta',
      'data': <String, Object?>{'entryId': entryId, 'text': text},
    };
  }

  /// 结束本次模型调用的流式正文；下一次增量会开新 entry。
  void endDelta() => _streamEntryId = null;

  int _nowOffset() {
    final int base = epochMs(startedAt) ?? 0;
    final int delta = DateTime.now().millisecondsSinceEpoch - base;
    return delta < 0 ? 0 : delta;
  }

  /// 映射一条原始事件；返回零或多条桥接事件（assistant 消息会展开成多条）。
  List<Map<String, Object?>> map(Map<String, Object?> event) {
    final int base = epochMs(startedAt) ?? 0;
    final int at = _offsetOf(event['time'], base);
    final List<Map<String, Object?>> out = <Map<String, Object?>>[];

    switch (event['type']) {
      case 'user/message':
        out.add(<String, Object?>{
          'seq': _seq++,
          'at': at,
          'type': 'message/user',
          'data': <String, Object?>{'text': _text(event['data'], 'text')},
        });
      case 'plan/updated':
        out.add(<String, Object?>{
          'seq': _seq++,
          'at': at,
          'type': 'plan/updated',
          'data': <String, Object?>{'items': _planItems(_mapOf(event['data']))},
        });
      case 'assistant/message':
        final Object? id = event['id'];
        final String? streamed = _streamQueue.isNotEmpty
            ? _streamQueue.removeAt(0)
            : _streamEntryId;
        _streamEntryId = null;
        final String entryId =
            streamed ??
            (id is String && id.isNotEmpty ? id : 'assistant-$_seq');
        out.add(<String, Object?>{
          'seq': _seq++,
          'at': at,
          'type': 'message/assistant/done',
          'data': <String, Object?>{
            'entryId': entryId,
            'text': _text(event['data'], 'text'),
            if (_hasText(event['data'], 'reasoning'))
              'reasoning': _text(event['data'], 'reasoning'),
          },
        });
        final Map<String, Object?> data = _mapOf(event['data']);
        for (final Object? call in _listOf(data['toolCalls'])) {
          final Map<String, Object?> tool = _mapOf(call);
          final String callId = tool['id'] is String
              ? tool['id']! as String
              : '';
          _startedCallAt[callId] = at;
          out.add(<String, Object?>{
            'seq': _seq++,
            'at': at,
            'type': 'tool/started',
            'data': <String, Object?>{
              'callId': callId,
              'name': tool['name'] ?? 'unknown',
              'args': tool['arguments'] ?? '{}',
            },
          });
        }
      case 'tool/result':
        final Map<String, Object?> data = _mapOf(event['data']);
        final String callId = data['callId'] is String
            ? data['callId']! as String
            : 'call-${_seq + 1}';
        final int startedAtMs = _startedCallAt[callId] ?? at;
        final String content = data['content'] is String
            ? data['content']! as String
            : '';
        out.add(<String, Object?>{
          'seq': _seq++,
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
    return out;
  }
}

/// 把原始 `events.jsonl` 条目投影成桥接事件，并按 `(at, 原序)` 重排后重新编号。
List<Map<String, Object?>> buildEventStream(
  List<Map<String, Object?>> rawEvents,
  String startedAt,
) {
  final EventMapper mapper = EventMapper(startedAt);
  final List<Map<String, Object?>> out = <Map<String, Object?>>[];
  for (final Map<String, Object?> event in rawEvents) {
    out.addAll(mapper.map(event));
  }

  final List<MapEntry<int, Map<String, Object?>>> indexed =
      <MapEntry<int, Map<String, Object?>>>[
        for (int i = 0; i < out.length; i += 1)
          MapEntry<int, Map<String, Object?>>(i, out[i]),
      ];
  indexed.sort((
    MapEntry<int, Map<String, Object?>> a,
    MapEntry<int, Map<String, Object?>> b,
  ) {
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
  final String line = text
      .split('\n')
      .firstWhere(
        (String candidate) => candidate.trim().isNotEmpty,
        orElse: () => '',
      );
  return line.length > 120 ? '${line.substring(0, 117)}…' : line;
}

/// 工具输出正文：超过 2000 字符截断。
String clipContent(String text) =>
    text.length > 2000 ? '${text.substring(0, 2000)}…' : text;

int _offsetOf(Object? time, int base) {
  final int parsed = epochMs(time) ?? base;
  final int delta = parsed - base;
  return delta < 0 ? 0 : delta;
}

Map<String, Object?> _mapOf(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

List<Map<String, Object?>> _planItems(Map<String, Object?> data) =>
    <Map<String, Object?>>[
      for (final Object? item in _listOf(data['steps']))
        if (item is Map<String, Object?>)
          <String, Object?>{
            'id': '${item['id'] ?? ''}',
            'title': '${item['text'] ?? item['title'] ?? ''}',
            'status': _planStatus(item),
          },
    ];

String _planStatus(Map<String, Object?> item) {
  final Object? raw = item['status'];
  if (raw is String && raw.isNotEmpty) return raw;
  return item['done'] == true ? 'done' : 'todo';
}

List<Object?> _listOf(Object? value) =>
    value is List<Object?> ? value : <Object?>[];

String _text(Object? data, String key) {
  final Object? value = _mapOf(data)[key];
  return value is String ? value : '';
}

bool _hasText(Object? data, String key) {
  final Object? value = _mapOf(data)[key];
  return value is String && value.isNotEmpty;
}
