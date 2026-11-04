/// 运行期尾随 `events.jsonl`：把新增的会话事件转成桥接事件推给前端。
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'projection_events.dart';

/// 增量读取一个不断追加的 JSONL 文件。
///
/// 只处理最后一个换行之前的内容，半行留到下一次；调用 [stop] 后不再读。
class JsonlTail {
  JsonlTail(this.path);

  /// 被尾随的文件。
  final String path;

  int _offset = 0;
  String _rest = '';
  bool _running = false;
  Timer? _timer;
  void Function(Map<String, Object?>)? _onEvent;

  /// 每 [interval] 读一次新增内容，把解析出的条目交给 [onEvent]。
  ///
  /// [startAtEnd] 为 true 时从当前文件末尾开始，只处理之后追加的内容。
  Future<void> start({
    required void Function(Map<String, Object?>) onEvent,
    Duration interval = const Duration(milliseconds: 250),
    bool startAtEnd = false,
  }) async {
    _running = true;
    _onEvent = onEvent;
    if (startAtEnd) {
      final File file = File(path);
      if (file.existsSync()) _offset = await file.length();
    }
    await _pump(onEvent);
    _timer = Timer.periodic(interval, (_) => unawaited(_pump(onEvent)));
  }

  /// 立即把当前已写入的内容读完。
  Future<void> flush() async {
    final void Function(Map<String, Object?>)? onEvent = _onEvent;
    if (onEvent != null) await _pump(onEvent);
  }

  /// 停止轮询。
  void stop() {
    _running = false;
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _pump(void Function(Map<String, Object?>) onEvent) async {
    if (!_running) return;
    final File file = File(path);
    if (!file.existsSync()) return;
    final RandomAccessFile handle = await file.open();
    try {
      final int length = await handle.length();
      if (length <= _offset) return;
      await handle.setPosition(_offset);
      final List<int> bytes = await handle.read(length - _offset);
      _offset = length;
      final String chunk = _rest + utf8.decode(bytes, allowMalformed: true);
      final List<String> lines = chunk.split('\n');
      _rest = lines.removeLast();
      for (final String line in lines) {
        final String trimmed = line.trim();
        if (trimmed.isEmpty) continue;
        try {
          final Object? decoded = jsonDecode(trimmed);
          if (decoded is Map<String, Object?>) onEvent(decoded);
        } on FormatException {
          continue;
        }
      }
    } finally {
      await handle.close();
    }
  }
}

/// 把 [JsonlTail] 的原始事件映射成桥接事件。
class RunEventStream {
  RunEventStream({
    required this.path,
    required this.startedAt,
    int startSeq = 0,
  }) : _startSeq = startSeq;

  /// `events.jsonl` 的路径。
  final String path;

  /// 运行开始时间。
  final String startedAt;

  final int _startSeq;
  late final EventMapper _mapper = EventMapper(startedAt, startSeq: _startSeq);
  JsonlTail? _tail;
  void Function(Map<String, Object?>)? _sink;
  final List<String> _pendingDeltas = <String>[];

  /// 已发出的桥接事件条数（供尾随结束后继续编号）。
  int get seq => _mapper.seq;

  /// 开始尾随；每条桥接事件都会交给 [onEvent]。
  Future<void> start(
    void Function(Map<String, Object?>) onEvent, {
    Duration interval = const Duration(milliseconds: 250),
    bool startAtEnd = false,
  }) async {
    _sink = onEvent;
    for (final String text in _pendingDeltas) {
      onEvent(_mapper.emitDelta(text));
    }
    _pendingDeltas.clear();
    final JsonlTail tail = JsonlTail(path);
    _tail = tail;
    await tail.start(
      onEvent: (Map<String, Object?> raw) {
        for (final Map<String, Object?> event in _mapper.map(raw)) {
          onEvent(event);
        }
      },
      interval: interval,
      startAtEnd: startAtEnd,
    );
  }

  /// 结束本次模型调用的流式正文。
  void endDelta() => _mapper.endDelta();

  /// 推一条流式正文增量。
  void emitDelta(String text) {
    final void Function(Map<String, Object?>)? sink = _sink;
    if (sink == null) {
      _pendingDeltas.add(text);
      return;
    }
    sink(_mapper.emitDelta(text));
  }

  /// 把已经写入文件的剩余事件立刻读完。
  Future<void> flush() async {
    final JsonlTail? tail = _tail;
    if (tail != null) await tail.flush();
  }

  /// 停止尾随。
  void stop() => _tail?.stop();
}
