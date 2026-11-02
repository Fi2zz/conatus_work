part of 'task_spec.dart';

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
      if (item is String) item else throw TaskSpecError(key, '数组元素必须是字符串'),
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

Map<String, ArtifactRule> _artifactRules(
  Map<String, Object?> json,
  List<String> artifacts,
) {
  final Object? raw = json['artifactRules'];
  if (raw == null) return const <String, ArtifactRule>{};
  if (raw is! Map<String, Object?>) {
    throw const TaskSpecError('artifactRules', '必须是对象');
  }
  final Map<String, ArtifactRule> rules = <String, ArtifactRule>{};
  for (final MapEntry<String, Object?> entry in raw.entries) {
    if (!artifacts.contains(entry.key)) {
      throw TaskSpecError(
        'artifactRules.${entry.key}',
        '路径必须在 expectedArtifacts 中',
      );
    }
    rules[entry.key] = _rule('artifactRules.${entry.key}', entry.value);
  }
  return rules;
}

ArtifactRule _rule(String field, Object? value) {
  if (value is! Map<String, Object?>) {
    throw TaskSpecError(field, '必须是对象');
  }
  final int? minChars = value['minChars'] as int?;
  final int? maxChars = value['maxChars'] as int?;
  if (minChars != null && minChars < 1) {
    throw TaskSpecError('$field.minChars', '至少为 1');
  }
  if (maxChars != null && (maxChars < 1 || maxChars < (minChars ?? 0))) {
    throw TaskSpecError('$field.maxChars', '必须 ≥ minChars 且 ≥ 1');
  }
  final String? check = value['check'] as String?;
  if (check != null && !kArtifactChecks.contains(check)) {
    throw TaskSpecError('$field.check', '未知校验器：$check');
  }
  return ArtifactRule(
    minChars: minChars,
    maxChars: maxChars,
    check: check,
    contains: _optionalStrings(value, 'contains'),
    requireSvg: value['requireSvg'] as bool? ?? false,
  );
}

List<String> _optionalStrings(Map<String, Object?> json, String key) =>
    json[key] == null ? const <String>[] : _strings(json, key);
