/// `run.json` 里的值类型：产物检查、人工救场、失败分类。
library;

import 'json_value.dart';

/// 失败分类；`null` 表示没有失败。
enum FailureCategory {
  artifact,
  llm,
  tool,
  timeout,
  budget,
  checkpoint,
  internal,
}

/// 单个期望产物的机检结果。
class ArtifactCheck {
  ArtifactCheck({
    required this.path,
    this.bytes = 0,
    this.sha256 = '',
    this.passed = false,
    this.reason,
  });

  /// 产物相对路径。
  String path;

  /// 字节数。
  int bytes;

  /// 内容的 sha256。
  String sha256;

  /// 是否通过。
  bool passed;

  /// 未通过原因：`missing` / `empty` / `notFile`。
  String? reason;

  Map<String, Object?> toJson() => <String, Object?>{
    'path': path,
    'bytes': bytes,
    'sha256': sha256,
    'check': <String, Object?>{
      'exists': reason != 'missing',
      'nonEmpty': reason != 'missing' && reason != 'empty',
      'passed': passed,
      'reason': reason,
    },
  };

  static ArtifactCheck fromJson(Map<String, Object?> json) {
    final Map<String, Object?> check = asJsonMap(json['check']);
    return ArtifactCheck(
      path: json['path'] as String? ?? '',
      bytes: json['bytes'] as int? ?? 0,
      sha256: json['sha256'] as String? ?? '',
      passed: check['passed'] as bool? ?? false,
      reason: check['reason'] as String?,
    );
  }
}

/// 人工救场记录。
class HumanEdit {
  HumanEdit({
    required this.at,
    required this.artifact,
    required this.note,
    this.sha256,
  });

  /// 记录时间。
  DateTime at;

  /// 被人工改动的产物。
  String artifact;

  /// 改动说明。
  String note;

  /// 记录时该产物的 sha256。
  String? sha256;

  Map<String, Object?> toJson() => <String, Object?>{
    'at': isoWithOffset(at),
    'artifact': artifact,
    'note': note,
    'sha256': sha256,
  };

  static HumanEdit fromJson(Map<String, Object?> json) => HumanEdit(
    at: DateTime.parse(json['at'] as String? ?? '1970-01-01T00:00:00Z'),
    artifact: json['artifact'] as String? ?? '',
    note: json['note'] as String? ?? '',
    sha256: json['sha256'] as String?,
  );
}

/// 失败分类与消息。
class RunFailure {
  RunFailure({this.category, this.message});

  FailureCategory? category;
  String? message;

  Map<String, Object?> toJson() => <String, Object?>{
    'category': category?.name,
    'message': message,
  };

  static RunFailure fromJson(Map<String, Object?> json) {
    final String? name = json['category'] as String?;
    return RunFailure(
      category: name == null ? null : FailureCategory.values.byName(name),
      message: json['message'] as String?,
    );
  }
}
