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

  test('计划状态别名归一', () {
    final EventMapper mapper = EventMapper(_startedAt);
    final List<Map<String, Object?>> out = mapper.map(<String, Object?>{
      'type': 'plan/updated',
      'time': _startedAt,
      'data': <String, Object?>{
        'steps': <Object?>[
          <String, Object?>{'id': '1', 'text': '扫描', 'status': 'in_progress'},
        ],
      },
    });
    final Map<String, Object?> data =
        out.single['data']! as Map<String, Object?>;
    final List<Object?> items = data['items']! as List<Object?>;
    expect((items.single as Map<String, Object?>)['status'], 'todo');
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

  test('两次模型调用各自复用最近的流式 entryId', () {
    final EventMapper mapper = EventMapper(_startedAt);
    final Map<String, Object?> first = mapper.emitDelta('第一');
    mapper.endDelta();
    final Map<String, Object?> second = mapper.emitDelta('第二');
    final String firstId =
        (first['data']! as Map<String, Object?>)['entryId']! as String;
    final String secondId =
        (second['data']! as Map<String, Object?>)['entryId']! as String;
    expect(secondId, isNot(firstId));

    final List<Map<String, Object?>> doneA = mapper.map(<String, Object?>{
      'type': 'assistant/message',
      'id': 'e1',
      'time': _startedAt,
      'data': <String, Object?>{'text': '第一'},
    });
    final List<Map<String, Object?>> doneB = mapper.map(<String, Object?>{
      'type': 'assistant/message',
      'id': 'e2',
      'time': _startedAt,
      'data': <String, Object?>{'text': '第二'},
    });
    expect((doneA.single['data']! as Map<String, Object?>)['entryId'], firstId);
    expect(
      (doneB.single['data']! as Map<String, Object?>)['entryId'],
      secondId,
    );
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
