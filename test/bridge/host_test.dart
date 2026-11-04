import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/bridge.dart';
import 'package:conatus_work/src/bridge/config_store.dart';
import 'package:conatus_work/src/bridge/host.dart';
import 'package:conatus_work/src/bridge/task_service.dart';
import 'package:test/test.dart';

import 'harness.dart';

void main() {
  late Directory runsRoot;
  late Directory configDir;
  late BridgeHost host;

  setUp(() {
    runsRoot = prepareRunsRoot('organize-v01');
    configDir = Directory.systemTemp.createTempSync('cfg_');
    host = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsRoot.path),
      configStore: ConfigStore(path: '${configDir.path}/config.json'),
    );
  });

  tearDown(() {
    runsRoot.deleteSync(recursive: true);
    configDir.deleteSync(recursive: true);
  });

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
    final Map<String, Object?> checkpoints =
        data['checkpoints']! as Map<String, Object?>;
    final Map<String, Object?> view =
        checkpoints['organize-v01']! as Map<String, Object?>;
    expect(view['currentTurn'], 1);
  });

  test('config.save 后可读回，且不回传 Key 明文', () async {
    final Map<String, Object?> saved = await call(
      'config.save',
      <String, Object?>{
        'baseUrl': 'https://example/v1',
        'model': 'm1',
        'apiKey': 'secret',
      },
    );
    expect(saved['ok'], isTrue);

    final Map<String, Object?> read = await call('config.read');
    final Map<String, Object?> value = read['value']! as Map<String, Object?>;
    expect(value['configured'], isTrue);
    expect(value['baseUrl'], 'https://example/v1');
    expect(value['hasKey'], isTrue);
    expect(value.containsKey('apiKey'), isFalse);
  });

  test('再次保存不传 Key 时保留旧 Key', () async {
    await call('config.save', <String, Object?>{
      'baseUrl': 'https://example/v1',
      'model': 'm1',
      'apiKey': 'secret',
    });
    await call('config.save', <String, Object?>{
      'baseUrl': 'https://example/v2',
      'model': 'm2',
    });
    final Map<String, Object?> read = await call('config.read');
    final Map<String, Object?> value = read['value']! as Map<String, Object?>;
    expect(value['baseUrl'], 'https://example/v2');
    expect(value['hasKey'], isTrue);
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

  test('unknown approval request 回 NOT_FOUND', () async {
    host = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsRoot.path),
      tasks: TaskService(
        runsDir: runsRoot.path,
        tasksDir: runsRoot.path,
        env: <String, String>{
          'WORK_LLM_BASE_URL': 'http://x',
          'WORK_LLM_MODEL': 'm',
        },
      ),
    );
    final Map<String, Object?> frame = await call(
      'approval.respond',
      <String, Object?>{'requestId': 'approval-nope', 'decision': 'allow'},
    );
    expect(frame['ok'], isFalse);
    expect((frame['error']! as Map<String, Object?>)['code'], 'NOT_FOUND');
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

  test('artifact.reveal 把绝对路径交给宿主', () async {
    final List<String> revealed = <String>[];
    final BridgeHost picker = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsRoot.path),
      revealArtifact: (String path) async => revealed.add(path),
    );
    final List<String> frames = await picker.dispatch(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'id': 'c7',
        'command': 'artifact.reveal',
        'payload': <String, Object?>{
          'runId': 'organize-v01',
          'path': 'out/changes.md',
        },
      }),
    );
    final Map<String, Object?> frame =
        jsonDecode(frames.single) as Map<String, Object?>;
    expect(frame['ok'], isTrue);
    expect(revealed.single, endsWith('out/changes.md'));
    expect(revealed.single, startsWith('/'));
  });

  test('未接线时 artifact.reveal 明确报错', () async {
    final Map<String, Object?> frame = await call(
      'artifact.reveal',
      <String, Object?>{'runId': 'organize-v01', 'path': 'out/changes.md'},
    );
    expect(frame['ok'], isFalse);
  });

  test('二进制产物回 base64，文本产物回 utf8', () async {
    final Directory runDir = Directory('${runsRoot.path}/organize-v01');
    final File png = File('${runDir.path}/workspace/out/pic.png')
      ..parent.createSync(recursive: true);
    png.writeAsBytesSync(<int>[137, 80, 78, 71]);
    final File runJson = File('${runDir.path}/run.json');
    final Map<String, Object?> run =
        jsonDecode(runJson.readAsStringSync()) as Map<String, Object?>;
    run['artifacts'] = <Object?>[
      ...(run['artifacts']! as List<Object?>),
      <String, Object?>{
        'path': 'out/pic.png',
        'bytes': 4,
        'sha256': 'x',
        'check': <String, Object?>{
          'exists': true,
          'nonEmpty': true,
          'passed': true,
        },
      },
    ];
    runJson.writeAsStringSync(jsonEncode(run));

    final Map<String, Object?> pngFrame = await call(
      'artifact.read',
      <String, Object?>{'runId': 'organize-v01', 'path': 'out/pic.png'},
    );
    final Map<String, Object?> pngValue =
        pngFrame['value']! as Map<String, Object?>;
    expect(pngValue['encoding'], 'base64');
    expect(pngValue['content'], base64Encode(<int>[137, 80, 78, 71]));

    final Map<String, Object?> textFrame = await call(
      'artifact.read',
      <String, Object?>{'runId': 'organize-v01', 'path': 'out/changes.md'},
    );
    expect((textFrame['value']! as Map<String, Object?>)['encoding'], 'utf8');
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
