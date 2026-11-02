/// 薄 CLI：解析参数、调运行器库、打印摘要。
library;

import 'dart:convert';
import 'dart:io';

import 'agent_task_body.dart';
import 'hash.dart';
import 'llm_config.dart';
import 'llm_runtime.dart';
import 'report.dart';
import 'run_paths.dart';
import 'run_store.dart';
import 'runner.dart';
import 'task_spec.dart';
import 'undo.dart';

/// 运行记录目录（相对当前工作目录）。
const String kRunsDir = 'var/runs';

/// 执行一条子命令，返回进程退出码。
Future<int> runCli(List<String> args) async {
  if (args.isEmpty) return _usage();
  final List<String> rest = args.sublist(1);
  return switch (args.first) {
    'list' => _list(),
    'run' => _run(rest),
    'resume' => _resume(rest),
    'abort' => _abort(rest),
    'undo' => _undo(rest),
    'report' => _report(rest),
    'edit' => _edit(rest),
    _ => _usage(),
  };
}

Future<int> _list() async {
  final Directory dir = Directory('tasks');
  if (!dir.existsSync()) {
    stderr.writeln('没有 tasks/ 目录');
    return 1;
  }
  final List<File> cards =
      dir
          .listSync()
          .whereType<File>()
          .where((File file) => file.path.endsWith('.json'))
          .toList()
        ..sort((File a, File b) => a.path.compareTo(b.path));
  for (final File file in cards) {
    try {
      final TaskSpec spec = await TaskSpec.load(file.path);
      stdout.writeln(
        '${spec.id} | ${spec.chain} | ${spec.title} | '
        '${spec.expectedArtifacts.join(', ')}',
      );
    } on TaskSpecError catch (error) {
      stdout.writeln('${file.path} | 不合法：${error.message}');
    }
  }
  return 0;
}

Future<int> _run(List<String> args) async {
  final String? card = _positional(args);
  if (card == null) return _usage();
  final LlmRuntime? runtime = _requireRuntime();
  if (runtime == null) return 2;
  final TaskSpec task = await TaskSpec.load(card);
  final RunRecord record = await Runner(body: agentTaskBody, llm: runtime).run(
    RunRequest(
      task: task,
      taskPath: File(card).absolute.path,
      workspaceRoot: _flag(args, '--workspace'),
      fixtureDir: _flag(args, '--fixture'),
      rerunOf: _flag(args, '--rerun-of'),
      confirmed: args.contains('--yes'),
    ),
  );
  stdout.writeln(_summary(record));
  return record.status == TaskRunStatus.succeeded ? 0 : 1;
}

Future<int> _resume(List<String> args) async {
  final String? runId = _positional(args);
  if (runId == null) return _usage();
  final LlmRuntime? runtime = _requireRuntime();
  if (runtime == null) return 2;
  final RunRecord record = await Runner(
    body: agentTaskBody,
    llm: runtime,
  ).resume(runId);
  stdout.writeln(_summary(record));
  return record.status == TaskRunStatus.succeeded ? 0 : 1;
}

Future<int> _abort(List<String> args) async {
  final String? runId = _positional(args);
  if (runId == null) return _usage();
  final RunRecord record = await Runner(body: agentTaskBody).abort(runId);
  stdout.writeln(_summary(record));
  return 0;
}

Future<int> _undo(List<String> args) async {
  final String? runId = _positional(args);
  if (runId == null) return _usage();
  final String? raw = _flag(args, '--steps');
  final int? steps = raw == null ? null : int.tryParse(raw);
  final RunRecord record = await Runner(
    body: agentTaskBody,
  ).undo(runId, steps: steps);
  stdout.writeln('已撤销：${record.runId} forkSessionId=${record.forkSessionId}');
  return 0;
}

Future<int> _report(List<String> args) async {
  final Directory dir = Directory(_positional(args) ?? kRunsDir);
  final List<RunRecord> records = <RunRecord>[];
  if (dir.existsSync()) {
    for (final FileSystemEntity entity in dir.listSync()) {
      final File file = File('${entity.path}${Platform.pathSeparator}run.json');
      if (!file.existsSync()) continue;
      final RunRecord? record = _tryLoad(file);
      if (record != null) records.add(record);
    }
  }
  stdout.writeln(renderReport(records));
  return 0;
}

Future<int> _edit(List<String> args) async {
  final String? runId = _positional(args);
  final String? artifact = _flag(args, '--artifact');
  final String? note = _flag(args, '--note');
  if (runId == null || artifact == null || note == null) return _usage();
  final RunStore store = RunStore(RunPaths(runsDir: kRunsDir, runId: runId));
  final RunRecord record = await store.load();
  final File file = File(
    '${record.workspaceRoot}${Platform.pathSeparator}$artifact',
  );
  record.humanEdits.add(
    HumanEdit(
      at: DateTime.now(),
      artifact: artifact,
      note: note,
      sha256: file.existsSync() ? sha256Hex(file.readAsBytesSync()) : null,
    ),
  );
  await store.save(record);
  stdout.writeln('已记录人工修改：$artifact');
  return 0;
}

LlmRuntime? _requireRuntime() {
  try {
    return LlmRuntime(config: llmConfigFromEnv(Platform.environment));
  } on LlmConfigError catch (error) {
    stderr.writeln('${error.message}：先导出 WORK_LLM_BASE_URL / WORK_LLM_MODEL');
    return null;
  }
}

String _summary(RunRecord record) =>
    'runId=${record.runId} status=${record.status.name} '
    'workspace=${record.workspaceRoot} '
    'turns=${record.startTurn ?? '-'}→${record.endTurn ?? '-'} '
    'checkpoint=${record.checkpointStatus.name}';

String? _positional(List<String> args) {
  for (final String arg in args) {
    if (!arg.startsWith('--')) return arg;
  }
  return null;
}

String? _flag(List<String> args, String name) {
  final int index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) return null;
  return args[index + 1];
}

RunRecord? _tryLoad(File file) {
  try {
    final Object? json = jsonDecode(file.readAsStringSync());
    return json is Map<String, Object?> ? RunRecord.fromJson(json) : null;
  } catch (_) {
    return null;
  }
}

Future<int> _usage() async {
  stdout.writeln('用法：');
  stdout.writeln('  runner list');
  stdout.writeln(
    '  runner run <card> [--workspace <dir>] [--rerun-of <runId>]',
  );
  stdout.writeln('  runner resume <runId>');
  stdout.writeln('  runner abort <runId>');
  stdout.writeln('  runner undo <runId> [--steps N]');
  stdout.writeln('  runner report [runsDir]');
  stdout.writeln('  runner edit <runId> --artifact <rel> --note <text>');
  return 64;
}
