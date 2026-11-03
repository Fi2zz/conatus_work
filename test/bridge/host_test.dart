import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/bridge.dart';
import 'package:conatus_work/src/bridge/host.dart';
import 'package:test/test.dart';

import 'harness.dart';

void main() {
  late Directory runsRoot;
  late BridgeHost host;

  setUp(() {
    runsRoot = prepareRunsRoot('organize-v01');
    host = BridgeHost(bridge: WorkbenchBridge(runsDir: runsRoot.path));
  });

  tearDown(() => runsRoot.deleteSync(recursive: true));

  Future<Map<String, Object?>> call(
    String command, [
    Map<String, Object?> payload = const <String, Object?>{},
  ]) async {
    final List<String> frames = await host.dispatch(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'id': 'c1',
        'command': command,
        'payload': payload,
      }),
    );
    expect(frames, hasLength(1));
    return jsonDecode(frames.single) as Map<String, Object?>;
  }

  test('hello 回 welcome 并推一条 snapshot 事件', () async {
    final List<String> frames = await host.dispatch(
      jsonEncode(<String, Object?>{'v': 1, 'kind': 'hello'}),
    );
    expect(frames, hasLength(2));
    expect(jsonDecode(frames.first), containsPair('kind', 'welcome'));

    final Map<String, Object?> event =
        jsonDecode(frames.last) as Map<String, Object?>;
    expect(event['kind'], 'event');
    final Map<String, Object?> snapshot =
        event['event']! as Map<String, Object?>;
    expect(snapshot['type'], 'snapshot');
    final Map<String, Object?> data = snapshot['data']! as Map<String, Object?>;
    expect(data['runs'], hasLength(1));
  });

  test('workspace.choose 返回注入的目录', () async {
    final BridgeHost picker = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsRoot.path),
      chooseWorkspace: () async => '/tmp/workspace',
    );
    final List<String> frames = await picker.dispatch(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'id': 'c9',
        'command': 'workspace.choose',
      }),
    );
    final Map<String, Object?> frame =
        jsonDecode(frames.single) as Map<String, Object?>;
    expect((frame['value']! as Map<String, Object?>)['path'], '/tmp/workspace');
  });

  test('task.list 返回任务摘要', () async {
    final Map<String, Object?> frame = await call('task.list');
    expect(frame['ok'], isTrue);
    final List<Object?> value = frame['value']! as List<Object?>;
    expect(value, hasLength(1));
    expect((value.single! as Map<String, Object?>)['id'], 'organize-v01');
  });

  test('task.open 返回与已提交 fixture 一致的投影', () async {
    final Map<String, Object?> frame = await call(
      'task.open',
      <String, Object?>{'runId': 'organize-v01'},
    );
    final Object? expected = jsonDecode(
      File(committedFixture).readAsStringSync(),
    );
    expect(frame['value'], equals(expected));
  });

  test('artifact.read 返回正文与截断标记', () async {
    final Map<String, Object?> frame = await call(
      'artifact.read',
      <String, Object?>{'runId': 'organize-v01', 'path': 'out/changes.md'},
    );
    final Map<String, Object?> value = frame['value']! as Map<String, Object?>;
    expect(value['truncated'], isFalse);
    expect((value['content']! as String).startsWith('#'), isTrue);
  });

  test('diff.open 返回变更集', () async {
    final Map<String, Object?> frame = await call(
      'diff.open',
      <String, Object?>{'runId': 'organize-v01'},
    );
    final Map<String, Object?> value = frame['value']! as Map<String, Object?>;
    expect(value['summary'], containsPair('moved', 10));
  });

  test('未知命令回错误帧而不是抛异常', () async {
    final Map<String, Object?> frame = await call('task.dance');
    expect(frame['ok'], isFalse);
    expect((frame['error']! as Map<String, Object?>)['code'], 'INTERNAL');
  });

  test('坏 JSON 回错误帧', () async {
    final List<String> frames = await host.dispatch('{nope');
    final Map<String, Object?> frame =
        jsonDecode(frames.single) as Map<String, Object?>;
    expect(frame['ok'], isFalse);
    expect((frame['error']! as Map<String, Object?>)['code'], 'INTERNAL');
  });

  test('缺 id 的命令被拒绝', () async {
    final List<String> frames = await host.dispatch(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'command': 'task.list',
      }),
    );
    final Map<String, Object?> frame =
        jsonDecode(frames.single) as Map<String, Object?>;
    expect(frame['ok'], isFalse);
  });

  test('未知 runId 回 NOT_FOUND', () async {
    final Map<String, Object?> frame = await call(
      'task.open',
      <String, Object?>{'runId': '../../etc'},
    );
    expect(frame['ok'], isFalse);
    expect((frame['error']! as Map<String, Object?>)['code'], 'NOT_FOUND');
  });

  test('未登记的产物路径回 NOT_FOUND', () async {
    final Map<String, Object?> frame = await call(
      'artifact.read',
      <String, Object?>{'runId': 'organize-v01', 'path': 'out/secrets.txt'},
    );
    expect((frame['error']! as Map<String, Object?>)['code'], 'NOT_FOUND');
  });
}
