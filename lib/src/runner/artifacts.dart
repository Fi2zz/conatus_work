/// 期望产物的机检：存在、非空、指纹。
library;

import 'dart:convert';
import 'dart:io';

import 'hash.dart';
import 'run_store.dart';
import 'task_spec.dart';

/// 按 [expected] 的顺序逐个检查 `root` 下的产物。
Future<List<ArtifactCheck>> checkArtifacts({
  required String root,
  required List<String> expected,
  Map<String, ArtifactRule> rules = const <String, ArtifactRule>{},
}) async {
  final List<ArtifactCheck> checks = <ArtifactCheck>[];
  for (final String path in expected) {
    checks.add(await _checkOne(root, path, rules[path]));
  }
  return checks;
}

Future<ArtifactCheck> _checkOne(
  String root,
  String path,
  ArtifactRule? rule,
) async {
  final File file = File('$root${Platform.pathSeparator}$path');
  final FileSystemEntityType type = await FileSystemEntity.type(file.path);
  if (type == FileSystemEntityType.notFound) {
    return ArtifactCheck(path: path, reason: 'missing');
  }
  if (type != FileSystemEntityType.file) {
    return ArtifactCheck(path: path, reason: 'notFile');
  }
  final List<int> bytes = await file.readAsBytes();
  if (bytes.isEmpty) {
    return ArtifactCheck(path: path, reason: 'empty');
  }
  final String? reason = _ruleFailure(rule, bytes);
  return ArtifactCheck(
    path: path,
    bytes: bytes.length,
    sha256: sha256Hex(bytes),
    passed: reason == null,
    reason: reason,
  );
}

String? _ruleFailure(ArtifactRule? rule, List<int> bytes) {
  if (rule == null) return null;
  final String text = utf8.decode(bytes, allowMalformed: true);
  final int count = _charCount(text);
  if (rule.minChars != null && count < rule.minChars!) return 'tooShort';
  if (rule.maxChars != null && count > rule.maxChars!) return 'tooLong';
  for (final String needle in rule.contains) {
    if (!text.contains(needle)) return 'missingText';
  }
  if (rule.requireSvg && !_looksLikeSvg(text)) return 'invalidSvg';
  return null;
}

int _charCount(String text) => text.replaceAll(RegExp(r'\s+'), '').length;

bool _looksLikeSvg(String text) {
  final String body = text
      .replaceAll(RegExp(r'<\?xml[^>]*\?>'), '')
      .replaceAll(RegExp(r'<!--[\s\S]*?-->'), '')
      .trim();
  return body.startsWith('<svg') && body.contains('</svg>');
}
