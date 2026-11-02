/// 工作区准备：解析根、建目录、注入检查点排除面。
library;

import 'dart:io';

import 'package:conatus/conatus.dart';

import 'task_spec.dart';

/// 一次运行的工作区边界。
class WorkspacePlan {
  const WorkspacePlan({
    required this.rootAbsolute,
    required this.readPrefixes,
    required this.writePrefixes,
  });

  /// 工作区根的绝对规范路径。
  final String rootAbsolute;

  /// 完整读集合（`read ∪ write`）。
  final List<String> readPrefixes;

  /// 可写前缀。
  final List<String> writePrefixes;
}

/// 解析工作区根：覆盖值优先，相对路径拼到 [cwd] 上。
String resolveWorkspaceRoot({
  required TaskSpec task,
  String? rootOverride,
  String cwd = '',
}) {
  final String base = cwd.isEmpty ? Directory.current.path : cwd;
  final String raw = rootOverride ?? task.workspaceRoot;
  final String absolute = _isAbsolute(raw)
      ? raw
      : '$base${Platform.pathSeparator}$raw';
  return normalizeReadOnlyPath(absolute);
}

/// 建立工作区根与写前缀目录，返回边界。
Future<WorkspacePlan> prepareWorkspace({
  required TaskSpec task,
  String? rootOverride,
}) async {
  final String root = resolveWorkspaceRoot(
    task: task,
    rootOverride: rootOverride,
  );
  await Directory(root).create(recursive: true);
  for (final String prefix in task.write) {
    await Directory(
      '$root${Platform.pathSeparator}$prefix',
    ).create(recursive: true);
  }
  return WorkspacePlan(
    rootAbsolute: root,
    readPrefixes: <String>{...task.read, ...task.write}.toList(growable: false),
    writePrefixes: List<String>.of(task.write),
  );
}

/// 预检失败：工作区根或输入不满足运行条件。
class RunPreflightError implements Exception {
  const RunPreflightError(this.message);

  /// 人可读的失败说明。
  final String message;

  @override
  String toString() => 'RunPreflightError: $message';
}

/// 不落盘的预检：根可用、输入都在。
Future<void> preflightRun(TaskSpec task, {String? rootOverride}) async {
  final String root = resolveWorkspaceRoot(
    task: task,
    rootOverride: rootOverride,
  );
  final FileSystemEntityType type = await FileSystemEntity.type(root);
  if (type != FileSystemEntityType.notFound &&
      type != FileSystemEntityType.directory) {
    throw RunPreflightError('工作区根不是目录：$root');
  }
  for (final String input in task.inputs) {
    final String path = '$root${Platform.pathSeparator}$input';
    if (await FileSystemEntity.type(path) == FileSystemEntityType.notFound) {
      throw RunPreflightError('输入不存在：$input');
    }
  }
}

/// 给模型的产品侧系统提示：工作区边界与产物纪律。
SystemPrompt productSystemPrompt(
  TaskSpec task,
  WorkspacePlan workspace, {
  bool confirmed = false,
}) {
  final SystemPrompt prompt = SystemPrompt();
  prompt.add(
    '你是本地文件工作台的执行者。\n'
    '工作区根：${workspace.rootAbsolute}\n'
    '可写前缀：${task.write.join('、')}\n'
    '只读前缀：${task.read.join('、')}\n'
    '期望产物：${task.expectedArtifacts.join('、')}\n'
    '规则：只能通过工具读写文件；不得写入可写前缀之外；'
    '不得编造 URL 或引文；不确定的内容标注「推断」。\n'
    '${confirmed ? '用户已确认执行，可以直接移动文件。' : '未获确认：不要移动、删除或改动已有文件；可以读取并在 out/ 写产物。'}',
  );
  return prompt;
}

/// 产品侧的检查点排除面：应用数据与影子仓库不进快照。
CheckpointPolicy productCheckpointPolicy() =>
    const CheckpointPolicy(excludedPrefixes: <String>['.conatus_work', '.git']);

bool _isAbsolute(String path) =>
    path.startsWith('/') || RegExp(r'^[A-Za-z]:').hasMatch(path);
