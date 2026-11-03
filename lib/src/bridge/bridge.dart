/// 桥接命令层：读投影、读产物、委托运行器撤销。
///
/// 只做「把已有事实翻译成契约」这一件事；不启动进程、不开端口。
library;

import 'dart:io';
import 'dart:typed_data';

import '../runner/run_types.dart';
import '../runner/runner.dart' show Runner, noopTaskBody;
import '../runner/undo.dart';
import 'projection.dart';
import 'projection_io.dart';

export 'contract.dart';
export 'projection.dart' show projectRunDir;

/// 桥接层能回答的命令。参数与返回见 `ui/src/bridge/transport.ts`。
class WorkbenchBridge {
  WorkbenchBridge({this.runsDir = 'var/runs'});

  /// `var/runs` 的位置。
  final String runsDir;

  /// 列出所有运行目录名（有 `run.json` 的才算）。
  List<String> runIds() {
    final Directory root = Directory(runsDir);
    if (!root.existsSync()) return <String>[];
    final List<String> ids = <String>[];
    for (final FileSystemEntity entity in root.listSync()) {
      if (entity is! Directory) continue;
      if (File('${entity.path}/run.json').existsSync()) {
        ids.add(entity.uri.pathSegments.lastWhere((String s) => s.isNotEmpty));
      }
    }
    ids.sort();
    return ids;
  }

  /// 任务列表：只读 `run.json` 与任务卡的标题，不重放事件。
  List<RunSummary> listTasks() {
    final List<RunSummary> tasks = <RunSummary>[];
    for (final String runId in runIds()) {
      final String dir = _runDir(runId);
      final Map<String, Object?>? run = readJsonObject('$dir/run.json');
      if (run == null) continue;
      final Map<String, Object?>? card = _card(dir, run);
      tasks.add(
        RunSummary(
          id: runId,
          taskId: run['taskId'] is String ? run['taskId']! as String : '',
          title: card?['title'] is String
              ? card!['title']! as String
              : (run['taskId'] is String ? run['taskId']! as String : runId),
          chain: run['chain'] is String ? run['chain']! as String : '',
          status: run['status'] is String ? run['status']! as String : 'running',
          model: run['model'] is String ? run['model']! as String : '',
          startedAt: run['startedAt'] is String ? run['startedAt']! as String : '',
          endedAt: run['endedAt'] is String ? run['endedAt']! as String : null,
          usage: run['usage'] is Map<String, Object?>
              ? run['usage']! as Map<String, Object?>
              : <String, Object?>{'inputTokens': 0, 'outputTokens': 0, 'costUsd': 0},
        ),
      );
    }
    return tasks;
  }

  /// 打开一次运行，返回完整回放 fixture。
  RunFixture openTask(String runId) => projectRunDir(_runDir(runId));

  /// 该运行的变更集；没有记录时为 null。
  Map<String, Object?>? changes(String runId) => openTask(runId).changes;

  /// 读产物正文。只放行 `run.artifacts` 里登记过的路径。
  String readArtifact(String runId, String path) {
    final String? content = readTextFile(_artifactFile(runId, path).path);
    if (content == null) {
      throw StateError('产物正文不可用：$path');
    }
    return content;
  }

  File _artifactFile(String runId, String path) {
    final String dir = _runDir(runId);
    final RunFixture fixture = projectRunDir(dir);
    final bool registered = fixture.artifacts.any(
      (Map<String, Object?> artifact) => artifact['path'] == path,
    );
    if (!registered) {
      throw StateError('未登记的产物路径：$path');
    }
    final String root = fixture.run['workspaceRoot'] == 'workspace'
        ? '$dir/workspace'
        : (fixture.run['workspaceRoot'] is String
              ? fixture.run['workspaceRoot']! as String
              : '');
    final File file = File('$root/$path');
    if (!file.existsSync()) {
      throw StateError('产物正文不可用：$path');
    }
    return file;
  }

  /// 产物的绝对路径（宿主用它打开所在文件夹）。
  String artifactPath(String runId, String path) =>
      _artifactFile(runId, path).absolute.path;

  /// 读产物原始字节（图片、PDF 等二进制产物用）。
  Uint8List readArtifactBytes(String runId, String path) {
    final File file = _artifactFile(runId, path);
    try {
      return file.readAsBytesSync();
    } on FileSystemException {
      throw StateError('产物正文不可用：$path');
    }
  }

  /// 撤销一次运行，复用阶段 0 的 `Runner.undo`（检查点 + 会话分叉 + 撤销点落盘）。
  Future<RunRecord> undo(String runId, {int? steps}) {
    _runDir(runId);
    return Runner(body: noopTaskBody, runsDir: runsDir).undo(runId, steps: steps);
  }

  /// 重做上次撤销；没有撤销点时抛 [StateError]。
  Future<RunRecord> redo(String runId) {
    _runDir(runId);
    return Runner(body: noopTaskBody, runsDir: runsDir).redo(runId);
  }

  String _runDir(String runId) {
    if (runId.isEmpty || runId.contains('/') || runId.contains('..')) {
      throw StateError('非法的 runId：$runId');
    }
    final String dir = '$runsDir/$runId';
    if (!Directory(dir).existsSync()) {
      throw StateError('没有这个运行：$runId');
    }
    return dir;
  }

  Map<String, Object?>? _card(String dir, Map<String, Object?> run) {
    final Map<String, Object?>? local = readJsonObject('$dir/task.json');
    if (local != null) return local;
    final Object? taskPath = run['taskPath'];
    return taskPath is String ? readJsonObject(taskPath) : null;
  }
}
