import 'dart:convert';
import 'dart:io';

import 'package:conatus_work/src/bridge/config_store.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;
  late ConfigStore store;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('config_');
    store = ConfigStore(path: '${tmp.path}/config.json');
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  test('保存后能读回，Key 不回传明文视图', () async {
    await store.save(
      const WorkbenchConfig(
        baseUrl: 'https://example/v1',
        model: 'm1',
        apiKey: 'secret-key',
        providerName: 'demo',
      ),
    );
    final WorkbenchConfig? loaded = store.load();
    expect(loaded?.baseUrl, 'https://example/v1');
    expect(loaded?.apiKey, 'secret-key');
    expect(loaded?.toView()['hasKey'], isTrue);
    expect(loaded?.toView().containsKey('apiKey'), isFalse);
  });

  test('配置文件权限收敛到 600', () async {
    await store.save(const WorkbenchConfig(baseUrl: 'u', model: 'm'));
    final String mode = (await Process.run('stat', <String>[
      '-f',
      '%Lp',
      store.path,
    ])).stdout.toString().trim();
    expect(mode, '600');
  });

  test('本地配置覆盖进程环境', () {
    final Map<String, String> merged = mergeEnv(<String, String>{
      'WORK_LLM_MODEL': 'from-env',
      'KEEP': '1',
    }, const WorkbenchConfig(baseUrl: 'http://file', model: 'from-file'));
    expect(merged['WORK_LLM_MODEL'], 'from-file');
    expect(merged['WORK_LLM_BASE_URL'], 'http://file');
    expect(merged['KEEP'], '1');
  });

  test('缺字段的配置被判为未配置', () {
    expect(validateConfig(null), contains('还没有配置'));
    expect(
      validateConfig(const WorkbenchConfig(baseUrl: '', model: '')),
      isNotNull,
    );
    expect(
      validateConfig(const WorkbenchConfig(baseUrl: 'u', model: 'm')),
      isNull,
    );
  });

  test('坏 JSON 不会抛，只当没配置', () {
    File('${tmp.path}/config.json').writeAsStringSync('{nope');
    expect(store.load(), isNull);
  });

  test('环境文件只认 WORK_LLM_ 键并去掉引号', () {
    final File envFile = File('${tmp.path}/env');
    envFile.writeAsStringSync(
      '# comment\nexport WORK_LLM_BASE_URL="https://x/v1"\n'
      'WORK_LLM_MODEL=m1\nOTHER=ignored\n',
    );
    final Map<String, String> values = parseEnvFile(envFile.path);
    expect(values, <String, String>{
      'WORK_LLM_BASE_URL': 'https://x/v1',
      'WORK_LLM_MODEL': 'm1',
    });
  });

  test('环境文件覆盖本地配置与进程环境', () {
    final Map<String, String> merged = mergeEnv(
      <String, String>{'WORK_LLM_MODEL': 'env'},
      const WorkbenchConfig(baseUrl: 'http://file', model: 'file'),
      envFile: <String, String>{'WORK_LLM_MODEL': 'envfile'},
    );
    expect(merged['WORK_LLM_MODEL'], 'envfile');
    expect(merged['WORK_LLM_BASE_URL'], 'http://file');
  });

  test('clear 删除文件', () async {
    await store.save(const WorkbenchConfig(baseUrl: 'u', model: 'm'));
    await store.clear();
    expect(File(store.path).existsSync(), isFalse);
    expect(jsonEncode(store.load()?.toJson()), 'null');
  });
}
