/// 结构化产物校验器：按名字跑一组固定检查，失败返回原因。
library;

import 'dart:convert';

/// 可用的校验器名单；任务卡写错名字会在解析期被拒绝。
const Set<String> kArtifactChecks = <String>{
  'sources-json',
  'changes-manifest',
};

/// 跑一个命名校验器；通过返回 null，失败返回 `reason`。
String? validateArtifact(String check, String text) {
  final Object? decoded = _decode(text);
  if (decoded == null) return 'invalidJson';
  return switch (check) {
    'sources-json' => _sources(decoded),
    'changes-manifest' => _changes(decoded),
    _ => 'unknownCheck',
  };
}

Object? _decode(String text) {
  try {
    return jsonDecode(text);
  } on FormatException {
    return null;
  }
}

/// 来源清单：≥6 条、≥3 条一手、每条抓取成功。
String? _sources(Object json) {
  if (json is! Map<String, Object?>) return 'invalidJson';
  final Object? raw = json['sources'];
  if (raw is! List<Object?>) return 'invalidJson';
  if (raw.length < 6) return 'tooFewSources';
  int primary = 0;
  for (final Object? item in raw) {
    if (item is! Map<String, Object?>) return 'invalidSource';
    final String? url = item['url'] as String?;
    final String? title = item['title'] as String?;
    final String? status = item['fetch_status'] as String?;
    if (url == null || title == null || status == null) return 'invalidSource';
    if (status != 'ok') return 'invalidSource';
    if (item['is_primary'] == true) primary += 1;
  }
  return primary < 3 ? 'noPrimarySources' : null;
}

/// 变更清单：操作完整、无删除、汇总与操作数一致。
String? _changes(Object json) {
  if (json is! Map<String, Object?>) return 'invalidJson';
  final Object? raw = json['operations'];
  if (raw is! List<Object?> || raw.isEmpty) return 'invalidJson';
  for (int i = 0; i < raw.length; i++) {
    final Object? item = raw[i];
    if (item is! Map<String, Object?>) return 'invalidJson';
    for (final String key in <String>['from', 'to', 'sha256', 'reason']) {
      if (item[key] == null) return 'missingField:operations[$i].$key';
    }
  }
  final Map<String, Object?> summary = _summary(json['summary']);
  final int moved = _int(summary['moved']);
  final int quarantined = _int(summary['quarantined']);
  final int deleted = _int(summary['deleted']);
  if (deleted != 0) return 'deletedFiles';
  return moved + quarantined == raw.length ? null : 'inconsistentSummary';
}

Map<String, Object?> _summary(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

int _int(Object? value) => value is int ? value : -1;
