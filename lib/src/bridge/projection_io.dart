/// 投影用到的最小文件 IO，全部返回可空值，不抛业务异常。
library;

import 'dart:convert';
import 'dart:io';

Map<String, Object?>? readJsonObject(String path) {
  final File file = File(path);
  if (!file.existsSync()) return null;
  try {
    final Object? decoded = jsonDecode(file.readAsStringSync());
    return decoded is Map<String, Object?> ? decoded : null;
  } on FormatException {
    return null;
  } on FileSystemException {
    return null;
  }
}

List<Map<String, Object?>> readJsonLines(String path) {
  final File file = File(path);
  if (!file.existsSync()) return <Map<String, Object?>>[];
  final List<Map<String, Object?>> events = <Map<String, Object?>>[];
  final List<String> lines;
  try {
    lines = file.readAsLinesSync();
  } on FileSystemException {
    return events;
  }
  for (final String line in lines) {
    final String trimmed = line.trim();
    if (trimmed.isEmpty) continue;
    try {
      final Object? decoded = jsonDecode(trimmed);
      if (decoded is Map<String, Object?>) events.add(decoded);
    } on FormatException {
      continue;
    }
  }
  return events;
}

String? readTextFile(String path) {
  final File file = File(path);
  if (!file.existsSync()) return null;
  try {
    return file.readAsStringSync();
  } on FileSystemException {
    return null;
  }
}

int? epochMs(Object? value) {
  if (value is! String || value.isEmpty) return null;
  try {
    return DateTime.parse(value).millisecondsSinceEpoch;
  } on FormatException {
    return null;
  }
}
