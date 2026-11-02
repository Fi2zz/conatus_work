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
