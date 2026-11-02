/// `run.json` 取值助手：宽容地把动态 JSON 转成类型化值。
library;

/// 非对象一律当空对象。
Map<String, Object?> asJsonMap(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

/// 非数组一律当空数组。
List<Object?> asJsonList(Object? value) =>
    value is List<Object?> ? value : const <Object?>[];

/// 非法日期返回 null。
DateTime? asJsonDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

/// ISO-8601 + 时区偏移：`toIso8601String()` 对本地时间不带偏移，UTC 又带 `Z`。
String isoWithOffset(DateTime time) {
  final DateTime local = time.toLocal();
  final Duration offset = local.timeZoneOffset;
  final String sign = offset.isNegative ? '-' : '+';
  final int minutes = offset.inMinutes.abs();
  final String stamp =
      '${local.year.toString().padLeft(4, '0')}-'
      '${_two(local.month)}-${_two(local.day)}T'
      '${_two(local.hour)}:${_two(local.minute)}:${_two(local.second)}'
      '.${local.millisecond.toString().padLeft(3, '0')}';
  return '$stamp$sign${_two(minutes ~/ 60)}:${_two(minutes % 60)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
