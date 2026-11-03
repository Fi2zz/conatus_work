import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';

/// CLI 必须以进程退出码结束，不能被遗留连接吊住。
void main() {
  test('失败的任务也会让进程按时退出', () async {
    final Directory tmp = Directory.systemTemp.createTempSync('cli_exit_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final File card = File('${tmp.path}/card.json')
      ..writeAsStringSync(
        jsonEncode(<String, Object?>{
          'id': 'exit-v01',
          'chain': 'research',
          'title': '退出测试',
          'workspace': <String, Object?>{
            'root': 'work',
            'read': <String>[],
            'write': <String>['out'],
          },
          'inputs': <String>[],
          'prompt': '空跑',
          'network': 'deny',
          'expectedArtifacts': <String>[],
          'acceptance': <String>[],
          'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
          'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
        }),
      );
    final ProcessResult result = await Process.run(
      'dart',
      <String>[
        'run',
        'bin/runner.dart',
        'run',
        card.path,
        '--workspace',
        '${tmp.path}/work',
      ],
      environment: <String, String>{
        'WORK_LLM_BASE_URL': 'http://127.0.0.1:1/v1',
        'WORK_LLM_MODEL': 'fake',
        'CONATUS_WORK_RUNS_DIR': '${tmp.path}/runs',
      },
    ).timeout(const Duration(seconds: 90));
    expect(result.exitCode, isNot(0));
  }, timeout: const Timeout(Duration(seconds: 120)));
}
