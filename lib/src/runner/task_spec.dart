/// 任务卡模型与校验：JSON 声明的一次运行要做什么、能动哪里。
///
/// 校验在这里一次做完，运行器后续步骤只信任 [TaskSpec]，不再重复判空。
/// 路径字段一律是工作区根下的相对路径，拒绝绝对路径与 `..`。
library;

import 'dart:convert';
import 'dart:io';

part 'task_spec_parse.dart';

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

/// 单条产物的额外判定规则。
class ArtifactRule {
  const ArtifactRule({
    this.minChars,
    this.contains = const <String>[],
    this.requireSvg = false,
  });

  /// 非空白字符数下限（中文按字计）。
  final int? minChars;

  /// 必须出现的子串。
  final List<String> contains;

  /// 必须是可解析的 SVG（最小检查：`<svg` 开头、含 `</svg>`）。
  final bool requireSvg;
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
    this.artifactRules = const <String, ArtifactRule>{},
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

  /// 按产物路径追加的判定规则。
  final Map<String, ArtifactRule> artifactRules;

  /// 从已解码的 JSON 对象解析；失败抛 [TaskSpecError]。
  static TaskSpec parse(Map<String, Object?> json) {
    final String chain = _string(json, 'chain');
    if (!kTaskChains.contains(chain)) {
      throw TaskSpecError('chain', '未知链路：$chain');
    }
    final Map<String, Object?> workspace = _map(json, 'workspace');
    final Map<String, Object?> limits = _map(json, 'limits');
    final Map<String, Object?> checkpoint = _map(json, 'checkpoint');
    final List<String> artifacts = _paths(json, 'expectedArtifacts');
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
      expectedArtifacts: artifacts,
      acceptance: _strings(json, 'acceptance'),
      allowNetwork: _network(json),
      maxMinutes: _integer(limits, 'maxMinutes'),
      maxCostUsd: _number(limits, 'maxCostUsd'),
      checkpointEnabled: _boolean(checkpoint, 'enabled'),
      checkpointKeep: keep,
      artifactRules: _artifactRules(json, artifacts),
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
