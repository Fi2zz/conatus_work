/// 任务卡模型与校验：JSON 声明的一次运行要做什么、能动哪里。
///
/// 校验在这里一次做完，运行器后续步骤只信任 [TaskSpec]，不再重复判空。
/// 路径字段一律是工作区根下的相对路径，拒绝绝对路径与 `..`。
library;

import 'dart:convert';
import 'dart:io';

/// 阶段 0 的三条任务链。
const Set<String> kTaskChains = <String>{'research', 'csv', 'organize'};

/// 任务卡不合法时抛出；[field] 是出错的字段路径。
class TaskSpecError implements Exception {
  const TaskSpecError(this.field, this.message);

  /// 字段路径，如 `workspace.write`。
  final String field;

  /// 人可读的失败说明。
  final String message;

  @override
  String toString() => 'TaskSpecError($field): $message';
}

/// 一张待执行的任务卡。
class TaskSpec {
  const TaskSpec({
    required this.id,
    required this.chain,
    required this.title,
    required this.prompt,
    required this.workspaceRoot,
    required this.read,
    required this.write,
    required this.inputs,
    required this.expectedArtifacts,
    required this.acceptance,
    required this.allowNetwork,
    required this.maxMinutes,
    required this.maxCostUsd,
    required this.checkpointEnabled,
    required this.checkpointKeep,
  });

  /// 任务标识（同一链路内唯一）。
  final String id;

  /// 所属任务链：`research` / `csv` / `organize`。
  final String chain;

  /// 面向人的标题。
  final String title;

  /// 交给 Agent 的任务说明。
  final String prompt;

  /// 工作区根（相对或绝对）。
  final String workspaceRoot;

  /// 可读的相对路径前缀。
  final List<String> read;

  /// 可写的相对路径前缀；空列表不合法。
  final List<String> write;

  /// 运行前必须存在的输入（根下相对路径）。
  final List<String> inputs;

  /// 运行后必须存在的产物（根下相对路径）。
  final List<String> expectedArtifacts;

  /// 人工验收判据（不参与机检）。
  final List<String> acceptance;

  /// 是否允许联网。
  final bool allowNetwork;

  /// 单次运行时长上限。
  final int maxMinutes;

  /// 单次运行成本上限（美元）。
  final double maxCostUsd;

  /// 是否启用检查点。
  final bool checkpointEnabled;

  /// 检查点保留轮数。
  final int checkpointKeep;

  /// 从已解码的 JSON 对象解析；失败抛 [TaskSpecError]。
  static TaskSpec parse(Map<String, Object?> json) {
    final String chain = _string(json, 'chain');
    if (!kTaskChains.contains(chain)) {
      throw TaskSpecError('chain', '未知链路：$chain');
    }
    final Map<String, Object?> workspace = _map(json, 'workspace');
    final Map<String, Object?> limits = _map(json, 'limits');
    final Map<String, Object?> checkpoint = _map(json, 'checkpoint');
    final int keep = _integer(checkpoint, 'keep');
    if (keep < 1) throw const TaskSpecError('checkpoint.keep', '至少为 1');
    return TaskSpec(
      id: _string(json, 'id'),
      chain: chain,
      title: _string(json, 'title'),
      prompt: _string(json, 'prompt'),
      workspaceRoot: _string(workspace, 'root'),
      read: _paths(workspace, 'read'),
      write: _paths(workspace, 'write', nonEmpty: true),
      inputs: _paths(json, 'inputs'),
      expectedArtifacts: _paths(json, 'expectedArtifacts'),
      acceptance: _strings(json, 'acceptance'),
      allowNetwork: _network(json),
      maxMinutes: _integer(limits, 'maxMinutes'),
      maxCostUsd: _number(limits, 'maxCostUsd'),
      checkpointEnabled: _boolean(checkpoint, 'enabled'),
      checkpointKeep: keep,
    );
  }

  /// 从文件加载任务卡。
  static Future<TaskSpec> load(String path) async {
    final Object? decoded = jsonDecode(await File(path).readAsString());
    if (decoded is! Map<String, Object?>) {
      throw const TaskSpecError('root', '任务卡必须是 JSON 对象');
    }
    return parse(decoded);
  }
}

String _string(Map<String, Object?> json, String key) {
  final Object? value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw TaskSpecError(key, '必须是非空字符串');
  }
  return value;
}

Map<String, Object?> _map(Map<String, Object?> json, String key) {
  final Object? value = json[key];
  if (value is! Map<String, Object?>) {
    throw TaskSpecError(key, '必须是对象');
  }
  return value;
}

bool _boolean(Map<String, Object?> json, String key) {
  final Object? value = json[key];
  if (value is! bool) throw TaskSpecError(key, '必须是布尔值');
  return value;
}

int _integer(Map<String, Object?> json, String key) {
  final Object? value = json[key];
  if (value is! int) throw TaskSpecError(key, '必须是整数');
  return value;
}

double _number(Map<String, Object?> json, String key) {
  final Object? value = json[key];
  if (value is! num) throw TaskSpecError(key, '必须是数字');
  return value.toDouble();
}

bool _network(Map<String, Object?> json) => switch (json['network']) {
      'allow' => true,
      'deny' => false,
      _ => throw const TaskSpecError('network', '必须是 allow 或 deny'),
    };

List<String> _strings(Map<String, Object?> json, String key) {
  final Object? value = json[key];
  if (value is! List<Object?>) throw TaskSpecError(key, '必须是数组');
  return <String>[
    for (final Object? item in value)
      if (item is String)
        item
      else
        throw TaskSpecError(key, '数组元素必须是字符串'),
  ];
}

List<String> _paths(
  Map<String, Object?> json,
  String key, {
  bool nonEmpty = false,
}) {
  final List<String> values = _strings(json, key);
  if (nonEmpty && values.isEmpty) {
    throw TaskSpecError(key, '不能为空');
  }
  for (final String value in values) {
    if (!_safeRelative(value)) {
      throw TaskSpecError(key, '必须是根下相对路径：$value');
    }
  }
  return values;
}

/// 相对路径且不含 `..`；不引 path 包。
bool _safeRelative(String value) {
  if (value.isEmpty) return false;
  if (value.startsWith('/') || value.contains(':')) return false;
  return !value.split(RegExp(r'[/\\]')).contains('..');
}
