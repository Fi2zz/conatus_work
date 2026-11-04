import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/bridge.dart';
import 'package:conatus_work/src/bridge/host.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/tools/rooted_fs.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson() => <String, Object?>{
  'id': 'move-v01',
  'chain': 'organize',
  'title': '移动一个文件',
  'workspace': <String, Object?>{
    'root': 'work',
    'read': <String>['inbox'],
    'write': <String>['inbox', 'out'],
  },
  'inputs': <String>['inbox/a.txt'],
  'prompt': '把 inbox/a.txt 移到 out/',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
};

void main() {
  late Directory tmp;
  late String cardPath;
  late String runsDir;
  late RunRecord record;

  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('revert_bridge_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
    Directory('${tmp.path}/work/inbox').createSync(recursive: true);
    File('${tmp.path}/work/inbox/a.txt').writeAsStringSync('a');
    runsDir = '${tmp.path}/runs';
    record =
        await Runner(
          runsDir: runsDir,
          body: (RunScope scope, TaskSpec task) async {
            await scope.fs.mkdir('out');
            await scope.fs.move('inbox/a.txt', 'out/a.txt');
            return const TaskOutcome.ok();
          },
        ).run(
          RunRequest(
            task: TaskSpec.parse(cardJson()),
            taskPath: cardPath,
            workspaceRoot: '${tmp.path}/work',
          ),
        );
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  Future<List<Map<String, Object?>>> call(
    BridgeHost host,
    String command,
    Map<String, Object?> payload,
  ) async {
    final List<String> frames = await host.dispatch(
      jsonEncode(<String, Object?>{
        'v': 1,
        'kind': 'command',
        'id': 'c1',
        'command': command,
        'payload': payload,
      }),
    );
    return <Map<String, Object?>>[
      for (final String frame in frames)
        jsonDecode(frame) as Map<String, Object?>,
    ];
  }

  test('undo 推送 started / finished 事件并回实际步数', () async {
    final List<String> pushed = <String>[];
    final BridgeHost host = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsDir),
      push: pushed.add,
    );

    final List<Map<String, Object?>> frames = await call(
      host,
      'undo',
      <String, Object?>{'runId': record.runId, 'steps': 1},
    );
    final Map<String, Object?> result = frames.single;
    expect(result['ok'], isTrue);
    final Map<String, Object?> value = result['value']! as Map<String, Object?>;
    expect(value['ok'], isTrue);
    expect(value['appliedSteps'], 1);
    expect(value['failures'], isEmpty);

    final List<Map<String, Object?>> events = <Map<String, Object?>>[
      for (final String frame in pushed)
        (jsonDecode(frame) as Map<String, Object?>)['event']!
            as Map<String, Object?>,
    ];
    expect(events.first['type'], 'undo/started');
    final Map<String, Object?> finished = events.last;
    expect(finished['type'], 'undo/finished');
    expect((finished['data']! as Map<String, Object?>)['appliedSteps'], 1);
  });

  test('redo 推送 redo/finished 事件', () async {
    final BridgeHost host = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsDir),
      push: (_) {},
    );
    await call(host, 'undo', <String, Object?>{'runId': record.runId});
    final List<String> pushed = <String>[];
    final BridgeHost redoHost = BridgeHost(
      bridge: WorkbenchBridge(runsDir: runsDir),
      push: pushed.add,
    );
    final List<Map<String, Object?>> frames = await call(
      redoHost,
      'redo',
      <String, Object?>{'runId': record.runId},
    );
    expect(frames.single['ok'], isTrue);
    final Map<String, Object?> event =
        (jsonDecode(pushed.single) as Map<String, Object?>)['event']!
            as Map<String, Object?>;
    expect(event['type'], 'redo/finished');
    expect((event['data']! as Map<String, Object?>)['ok'], isTrue);
  });
}
