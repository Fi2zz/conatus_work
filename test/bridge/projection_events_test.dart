import 'package:conatus_work/src/bridge/projection_events.dart';
import 'package:test/test.dart';

const String _startedAt = '2026-11-03T10:00:00.000+08:00';

void main() {
  test('plan/updated 映射成契约的 items', () {
    final EventMapper mapper = EventMapper(_startedAt);
    final List<Map<String, Object?>> out = mapper.map(<String, Object?>{
      'type': 'plan/updated',
      'time': _startedAt,
      'data': <String, Object?>{
        'goal': '整理收件箱',
        'steps': <Object?>[
          <String, Object?>{'id': '1', 'text': '扫描', 'done': true},
          <String, Object?>{'id': '2', 'text': '移动', 'done': false},
        ],
      },
    });

    expect(out, hasLength(1));
    expect(out.single['type'], 'plan/updated');
    final Map<String, Object?> data =
        out.single['data']! as Map<String, Object?>;
    expect(data['items'], <Object?>[
      <String, Object?>{'id': '1', 'title': '扫描', 'status': 'done'},
      <String, Object?>{'id': '2', 'title': '移动', 'status': 'todo'},
    ]);
  });

  test('流式增量与最终消息共用一个 entryId', () {
    final EventMapper mapper = EventMapper(_startedAt);
    final Map<String, Object?> first = mapper.emitDelta('你');
    final Map<String, Object?> second = mapper.emitDelta('好');
    final String entryId =
        (first['data']! as Map<String, Object?>)['entryId']! as String;
    expect((second['data']! as Map<String, Object?>)['entryId'], entryId);

    final List<Map<String, Object?>> done = mapper.map(<String, Object?>{
      'type': 'assistant/message',
      'id': 'event-1',
      'time': _startedAt,
      'data': <String, Object?>{'text': '你好'},
    });
    final Map<String, Object?> data =
        done.single['data']! as Map<String, Object?>;
    expect(done.single['type'], 'message/assistant/done');
    expect(data['entryId'], entryId);

    final Map<String, Object?> next = mapper.emitDelta('下一轮');
    expect((next['data']! as Map<String, Object?>)['entryId'], isNot(entryId));
  });

  test('不同 seq 基数的增量不共用 entryId', () {
    final Map<String, Object?> first = EventMapper(_startedAt).emitDelta('a');
    final Map<String, Object?> second = EventMapper(
      _startedAt,
      startSeq: 10,
    ).emitDelta('b');
    final String firstId =
        (first['data']! as Map<String, Object?>)['entryId']! as String;
    final String secondId =
        (second['data']! as Map<String, Object?>)['entryId']! as String;
    expect(secondId, isNot(firstId));
  });
}
