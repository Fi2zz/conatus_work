/// 运行中轮询产物与变更，把变化实时推给宿主。
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../runner/artifacts.dart';
import '../runner/run_store.dart';
import '../runner/task_spec.dart';
import 'projection_io.dart';
import 'projection_payload.dart';

/// 实时事件出口：`type` 是桥接事件名。
typedef LiveEventSink = void Function(String type, Map<String, Object?> data);

/// 按固定间隔检查期望产物与 `out/changes.json`；只在内容变化时发事件。
class LiveWatcher {
  LiveWatcher({
    required this.task,
    required this.root,
    required this.sessionPath,
    required this.interval,
    required this.emit,
  });

  final TaskSpec task;
  final String root;
  final String sessionPath;
  final Duration interval;
  final LiveEventSink emit;

  final Map<String, String> _artifactDigest = <String, String>{};
  final Map<String, String> _fileStamp = <String, String>{};
  String? _changesDigest;
  int _sessionSize = -1;
  int _changesSize = -1;
  Timer? _timer;
  Future<void>? _current;
  bool _busy = false;
  bool _stopped = false;

  /// 开始轮询。
  void start() {
    _timer = Timer.periodic(interval, (_) {
      _current = _tick();
    });
  }

  /// 停止轮询，并等待正在执行的 tick 收尾。
  Future<void> stop() async {
    _stopped = true;
    _timer?.cancel();
    _timer = null;
    await _current;
  }

  Future<void> _tick() async {
    if (_busy || _stopped) return;
    _busy = true;
    try {
      await _checkArtifacts();
      _checkChanges();
    } on Object {
      // 单次轮询失败（文件正在被改写 / 权限变化）不能影响运行。
    } finally {
      _busy = false;
    }
  }

  Future<void> _checkArtifacts() async {
    if (task.expectedArtifacts.isEmpty) return;
    final Map<String, String> stamps = <String, String>{};
    bool changed = false;
    for (final String path in task.expectedArtifacts) {
      final String stamp = _stampOf('$root/$path');
      stamps[path] = stamp;
      if (_fileStamp[path] != stamp) changed = true;
    }
    if (!changed) return;
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: root,
      expected: task.expectedArtifacts,
      rules: task.artifactRules,
    );
    for (final ArtifactCheck check in checks) {
      _fileStamp[check.path] =
          stamps[check.path] ?? _stampOf('$root/${check.path}');
      final String? previous = _artifactDigest[check.path];
      if (previous == null && check.reason == 'missing') continue;
      final String digest =
          '${check.sha256}:${check.bytes}:${check.passed}:${check.reason}';
      if (previous == digest) continue;
      _artifactDigest[check.path] = digest;
      if (_stopped) return;
      emit(
        previous == null ? 'artifact/added' : 'artifact/updated',
        check.toJson(),
      );
    }
  }

  void _checkChanges() {
    final int sessionSize = _sizeOf(sessionPath);
    final int changesSize = _sizeOf('$root/out/changes.json');
    if (sessionSize == _sessionSize && changesSize == _changesSize) return;
    _sessionSize = sessionSize;
    _changesSize = changesSize;
    final Map<String, Object?>? changes = buildChanges(
      root,
      readJsonLines(sessionPath),
    );
    if (changes == null) return;
    final String digest = jsonEncode(changes);
    if (digest == _changesDigest) return;
    _changesDigest = digest;
    if (_stopped) return;
    emit('changes/updated', changes);
  }

  String _stampOf(String path) {
    final File file = File(path);
    if (!file.existsSync()) return 'missing';
    try {
      final FileStat stat = file.statSync();
      return '${stat.modified.millisecondsSinceEpoch}:${stat.size}';
    } on FileSystemException {
      return 'unreadable';
    }
  }

  int _sizeOf(String path) {
    final File file = File(path);
    if (!file.existsSync()) return 0;
    try {
      return file.lengthSync();
    } on FileSystemException {
      return 0;
    }
  }
}
