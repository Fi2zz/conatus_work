import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/run_watch.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;
  late File log;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('watch_');
    log = File('${tmp.path}/events.jsonl');
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  Map<String, Object?> line(String type, Map<String, Object?> data) =>
      <String, Object?>{'type': type, 'time': '2026-11-03T10:00:01.000', 'data': data};

  test('增量读取新增行，半行留到下一次', () async {
    final List<Map<String, Object?>> seen = <Map<String, Object?>>[];
    final JsonlTail tail = JsonlTail(log.path);
    addTearDown(tail.stop);

    log.writeAsStringSync('${jsonEncode(line('user/message', <String, Object?>{'text': '第一条'}))}\n');
    await tail.start(onEvent: seen.add, interval: const Duration(milliseconds: 20));
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(seen, hasLength(1));

    // 半行：不完整，不应被消费
    log.writeAsStringSync(
      '{"type":"user/message","time":"2026-11-03T10:00:02.000","data":{"text":"半',
      mode: FileMode.append,
    );
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(seen, hasLength(1));

    log.writeAsStringSync(
      '行"}}\n',
      mode: FileMode.append,
    );
    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(seen, hasLength(2));
    expect((seen.last['data']! as Map<String, Object?>)['text'], '半行');
  });

  test('RunEventStream 把会话事件映射成桥接事件并连续编号', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final RunEventStream stream = RunEventStream(
      path: log.path,
      startedAt: '2026-11-03T10:00:00.000',
    );
    addTearDown(stream.stop);

    log.writeAsStringSync(
      '${jsonEncode(line('user/message', <String, Object?>{'text': '开始'}))}\n'
      '${jsonEncode(<String, Object?>{
        'type': 'assistant/message',
        'time': '2026-11-03T10:00:03.000',
        'id': 'a1',
        'data': <String, Object?>{'text': '我看一下', 'toolCalls': <Object?>[]},
      })}\n',
    );

    await stream.start(
      events.add,
      interval: const Duration(milliseconds: 20),
    );
    await Future<void>.delayed(const Duration(milliseconds: 80));

    expect(events.map((Map<String, Object?> e) => e['type']), <String>[
      'message/user',
      'message/assistant/done',
    ]);
    expect(events.first['seq'], 0);
    expect(events.last['seq'], 1);
    expect(events.last['at'], 3000);
  });
}
