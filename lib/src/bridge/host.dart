/// WebView 宿主侧：一条 JSON 帧进，零或多条 JSON 帧出。
///
/// 不做 IO、不起进程；Flutter 只需把平台消息通道的两端接到 [dispatch] 与返回值。
library;

import 'dart:convert';

import '../runner/run_types.dart';
import 'bridge.dart';

/// 协议版本。信封里不带版本或版本不符的一律拒绝。
const int kProtocolVersion = 1;

/// 命令分发器。异常一律收敛成错误帧，不向上抛。
class BridgeHost {
  BridgeHost({required this.bridge});

  /// 底层命令实现。
  final WorkbenchBridge bridge;

  /// 处理一条入站帧，返回要发回前端的帧。
  Future<List<String>> dispatch(String raw) async {
    final Object? decoded = _decode(raw);
    if (decoded is! Map<String, Object?>) {
      return <String>[_error(null, 'INTERNAL', '不是 JSON 对象')];
    }
    final Object? version = decoded['v'];
    if (version != null && version != kProtocolVersion) {
      return <String>[_error(null, 'INTERNAL', '不支持的协议版本：$version')];
    }
    if (decoded['kind'] == 'hello') {
      return <String>[
        _frame(<String, Object?>{'v': kProtocolVersion, 'kind': 'welcome'}),
        _eventFrame(_snapshot()),
      ];
    }
    final Object? id = decoded['id'];
    if (decoded['kind'] != 'command' || id is! String || id.isEmpty) {
      return <String>[_error(null, 'INTERNAL', '缺少 command 或 id')];
    }
    final Object? command = decoded['command'];
    if (command is! String || command.isEmpty) {
      return <String>[_error(id, 'INTERNAL', '缺少命令名')];
    }
    try {
      return <String>[
        _result(id, await _run(command, _payloadOf(decoded['payload']))),
      ];
    } on StateError catch (error) {
      return <String>[_error(id, 'NOT_FOUND', error.message)];
    } catch (error) {
      return <String>[_error(id, 'INTERNAL', '$error')];
    }
  }

  Map<String, Object?> _snapshot() => <String, Object?>{
    'seq': -1,
    'at': 0,
    'type': 'snapshot',
    'data': <String, Object?>{
      'runs': <Object?>[
        for (final RunSummary task in bridge.listTasks()) task.toJson(),
      ],
      'activeRunId': null,
    },
  };

  Future<Object?> _run(String command, Map<String, Object?> payload) async {
    switch (command) {
      case 'task.list':
        return <Object?>[
          for (final RunSummary task in bridge.listTasks()) task.toJson(),
        ];
      case 'task.open':
        return bridge.openTask(_requireString(payload, 'runId')).toJson();
      case 'artifact.read':
        final String runId = _requireString(payload, 'runId');
        final String path = _requireString(payload, 'path');
        final String content = bridge.readArtifact(runId, path);
        final bool truncated = bridge
            .openTask(runId)
            .artifacts
            .any((Map<String, Object?> item) => item['path'] == path && item['truncated'] == true);
        return <String, Object?>{'content': content, 'truncated': truncated};
      case 'diff.open':
        final Map<String, Object?>? changes = bridge.changes(
          _requireString(payload, 'runId'),
        );
        if (changes == null) throw StateError('该运行未记录变更');
        return changes;
      case 'undo':
        final Object? steps = payload['steps'];
        final RunRecord record = await bridge.undo(
          _requireString(payload, 'runId'),
          steps: steps is num ? steps.toInt() : null,
        );
        return <String, Object?>{
          'ok': true,
          'appliedSteps': steps is num ? steps.toInt() : 1,
          'failures': <Object?>[],
          'forkSessionId': record.forkSessionId,
        };
      case 'redo':
        final RunRecord record = await bridge.redo(
          _requireString(payload, 'runId'),
        );
        return <String, Object?>{
          'ok': true,
          'appliedSteps': 1,
          'failures': <Object?>[],
          'forkSessionId': record.forkSessionId,
        };
      default:
        throw ArgumentError('未知命令：$command');
    }
  }

  String _requireString(Map<String, Object?> payload, String key) {
    final Object? value = payload[key];
    if (value is! String || value.isEmpty) {
      throw ArgumentError('缺少参数：$key');
    }
    return value;
  }
}

Object? _decode(String raw) {
  try {
    return jsonDecode(raw);
  } on FormatException {
    return null;
  }
}

Map<String, Object?> _payloadOf(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};

String _frame(Map<String, Object?> frame) => jsonEncode(frame);

String _eventFrame(Map<String, Object?> event) => _frame(<String, Object?>{
  'v': kProtocolVersion,
  'kind': 'event',
  'event': event,
});

String _result(String id, Object? value) => _frame(<String, Object?>{
  'v': kProtocolVersion,
  'kind': 'result',
  'id': id,
  'ok': true,
  'value': value,
});

String _error(String? id, String code, String message) => _frame(<String, Object?>{
  'v': kProtocolVersion,
  'kind': 'result',
  if (id != null) 'id': id,
  'ok': false,
  'error': <String, Object?>{'code': code, 'message': message},
});
