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
  final String root = resolveWorkspaceRoot(task: task, rootOverride: rootOverride);
  await Directory(root).create(recursive: true);
  for (final String prefix in task.write) {
    await Directory('$root${Platform.pathSeparator}$prefix')
        .create(recursive: true);
  }
  return WorkspacePlan(
    rootAbsolute: root,
    readPrefixes: <String>{...task.read, ...task.write}.toList(growable: false),
    writePrefixes: List<String>.of(task.write),
  );
}

/// 产品侧的检查点排除面：应用数据与影子仓库不进快照。
CheckpointPolicy productCheckpointPolicy() => const CheckpointPolicy(
      excludedPrefixes: <String>['.conatus_work', '.git'],
    );

bool _isAbsolute(String path) =>
    path.startsWith('/') || RegExp(r'^[A-Za-z]:').hasMatch(path);
