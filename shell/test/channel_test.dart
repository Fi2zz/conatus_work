import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/conatus_work.dart';
import 'package:conatus_work_shell/channel.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late Directory runsRoot;
  late List<String> outbound;
  late ShellChannel channel;

  setUp(() {
    runsRoot = Directory.systemTemp.createTempSync('runs_');
    outbound = <String>[];
    channel = ShellChannel(
      host: BridgeHost(bridge: WorkbenchBridge(runsDir: runsRoot.path)),
      post: outbound.add,
    );
  });

  tearDown(() => runsRoot.deleteSync(recursive: true));

  test('hello 回 welcome', () async {
    final int count = await channel.receive(
      jsonEncode(<String, Object?>{'v': 1, 'kind': 'hello'}),
    );
    expect(count, 1);
    expect(
      jsonDecode(outbound.single) as Map<String, Object?>,
      containsPair('kind', 'welcome'),
    );
  });

  test('task.list 在空目录上返回空列表', () async {
    await channel.receive(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'id': 'c1',
        'command': 'task.list',
      }),
    );
    final Map<String, Object?> frame =
        jsonDecode(outbound.single) as Map<String, Object?>;
    expect(frame['ok'], isTrue);
    expect(frame['value'], isEmpty);
  });

  test('坏 JSON 也回一帧错误，不抛', () async {
    final int count = await channel.receive('{nope');
    expect(count, 1);
    final Map<String, Object?> frame =
        jsonDecode(outbound.single) as Map<String, Object?>;
    expect(frame['ok'], isFalse);
  });

  test('未知 runId 回 NOT_FOUND', () async {
    await channel.receive(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'id': 'c2',
        'command': 'task.open',
        'payload': <String, Object?>{'runId': 'nope'},
      }),
    );
    final Map<String, Object?> frame =
        jsonDecode(outbound.single) as Map<String, Object?>;
    expect((frame['error']! as Map<String, Object?>)['code'], 'NOT_FOUND');
  });
}
