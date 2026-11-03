import 'package:conatus_work/src/runner/cli.dart';
import 'package:test/test.dart';

void main() {
  test('无参数打印用法并返回 64', () async {
    expect(await runCli(const <String>[]), 64);
  });

  test('任务卡不存在时返回 1 而不是抛栈', () async {
    expect(await runCli(<String>['run', '/nonexistent/card.json']), 1);
  });

  test('redo 缺少 runId 时打印用法并返回 64', () async {
    expect(await runCli(<String>['redo']), 64);
  });

  test('redo 未知运行返回 1 而不是抛栈', () async {
    expect(await runCli(<String>['redo', 'run_nope']), 1);
  });

  test('未知子命令返回 64', () async {
    expect(await runCli(<String>['nope']), 64);
  });

  test('未知 --flag 不吞掉位置参数', () async {
    expect(
      await runCli(<String>['run', '/nonexistent/a.json', '--fixture']),
      1,
    );
  });
}
