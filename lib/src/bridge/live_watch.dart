/// 运行中轮询产物与变更，把变化实时推给宿主。
library;

import 'dart:async';
import 'dart:convert';

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
  String? _changesDigest;
  Timer? _timer;
  bool _busy = false;

  /// 开始轮询。
  void start() {
    _timer = Timer.periodic(interval, (_) => unawaited(_tick()));
  }

  /// 停止轮询。
  void stop() => _timer?.cancel();

  Future<void> _tick() async {
    if (_busy) return;
    _busy = true;
    try {
      await _checkArtifacts();
      _checkChanges();
    } finally {
      _busy = false;
    }
  }

  Future<void> _checkArtifacts() async {
    if (task.expectedArtifacts.isEmpty) return;
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: root,
      expected: task.expectedArtifacts,
      rules: task.artifactRules,
    );
    for (final ArtifactCheck check in checks) {
      final String? previous = _artifactDigest[check.path];
      if (previous == null && check.reason == 'missing') continue;
      final String digest =
          '${check.sha256}:${check.bytes}:${check.passed}:${check.reason}';
      if (previous == digest) continue;
      _artifactDigest[check.path] = digest;
      emit(
        previous == null ? 'artifact/added' : 'artifact/updated',
        check.toJson(),
      );
    }
  }

  void _checkChanges() {
    final Map<String, Object?>? changes = buildChanges(
      root,
      readJsonLines(sessionPath),
    );
    if (changes == null) return;
    final String digest = jsonEncode(changes);
    if (digest == _changesDigest) return;
    _changesDigest = digest;
    emit('changes/updated', changes);
  }
}
