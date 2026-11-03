/// WebView 宿主侧：一条 JSON 帧进，零或多条 JSON 帧出。
///
/// 不做 IO、不起进程；Flutter 只需把平台消息通道的两端接到 [dispatch] 与返回值。
library;

import 'dart:convert';
import 'dart:typed_data';

import '../runner/run_types.dart';
import 'bridge.dart';
import 'config_store.dart';
import 'task_service.dart';

/// 协议版本。信封里不带版本或版本不符的一律拒绝。
const int kProtocolVersion = 1;

/// 命令分发器。异常一律收敛成错误帧，不向上抛。
class BridgeHost {
  BridgeHost({
    required this.bridge,
    this.tasks,
    this.push,
    this.chooseWorkspace,
    this.revealArtifact,
    this.configStore,
  });

  /// 底层命令实现。
  final WorkbenchBridge bridge;

  /// 真实执行服务；未接线时 `task.start` / `task.cards` 回错误。
  final TaskService? tasks;

  /// 异步事件出口（运行期增量事件从这里推给前端）。
  final void Function(String json)? push;

  /// 打开系统文件选择器选工作区；未接线时回 null。
  final Future<String?> Function()? chooseWorkspace;

  /// 在系统文件管理器里定位产物；未接线时回错误。
  final Future<void> Function(String path)? revealArtifact;

  /// 本地模型配置；未接线时设置页只读。
  final ConfigStore? configStore;

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
        final bool truncated = bridge
            .openTask(runId)
            .artifacts
            .any((Map<String, Object?> item) => item['path'] == path && item['truncated'] == true);
        if (_isBinary(path)) {
          final Uint8List bytes = bridge.readArtifactBytes(runId, path);
          return <String, Object?>{
            'content': base64Encode(bytes),
            'encoding': 'base64',
            'truncated': false,
          };
        }
        return <String, Object?>{
          'content': bridge.readArtifact(runId, path),
          'encoding': 'utf8',
          'truncated': truncated,
        };
      case 'task.cards':
        final TaskService service = _tasks();
        return <Object?>[
          for (final TaskCard card in service.cards()) card.toJson(),
        ];
      case 'config.read':
        final WorkbenchConfig? saved = configStore?.load();
        return <String, Object?>{
          'configured': saved != null,
          ...?saved?.toView(),
        };
      case 'config.save':
        final ConfigStore? store = configStore;
        if (store == null) throw StateError('宿主未接线配置存储');
        final WorkbenchConfig? previous = store.load();
        final Object? key = payload['apiKey'];
        final WorkbenchConfig next = WorkbenchConfig(
          baseUrl: _requireString(payload, 'baseUrl'),
          model: _requireString(payload, 'model'),
          apiKey: key is String && key.isNotEmpty ? key : previous?.apiKey,
          providerName: payload['providerName'] is String
              ? payload['providerName']! as String
              : null,
          priceInput: payload['priceInput'] is num
              ? (payload['priceInput']! as num).toDouble()
              : null,
          priceOutput: payload['priceOutput'] is num
              ? (payload['priceOutput']! as num).toDouble()
              : null,
        );
        await store.save(next);
        return <String, Object?>{'configured': true, ...next.toView()};
      case 'config.clear':
        await configStore?.clear();
        return <String, Object?>{'configured': false};
      case 'artifact.reveal':
        final String revealRun = _requireString(payload, 'runId');
        final String revealPath = _requireString(payload, 'path');
        final String absolute = bridge.artifactPath(revealRun, revealPath);
        final Future<void> Function(String path)? reveal = revealArtifact;
        if (reveal == null) throw StateError('宿主未接线「打开所在文件夹」');
        await reveal(absolute);
        return <String, Object?>{'path': absolute};
      case 'workspace.choose':
        final String? path = await chooseWorkspace?.call();
        return <String, Object?>{'path': path};
      case 'task.start':
        final TaskService service = _tasks();
        final Object? workspace = payload['workspaceRoot'];
        final String runId = await service.start(
          cardId: _requireString(payload, 'cardId'),
          workspaceRoot: workspace is String && workspace.isNotEmpty
              ? workspace
              : null,
          onEvent: (Map<String, Object?> event) => push?.call(_eventFrame(event)),
        );
        return <String, Object?>{'runId': runId};
      case 'task.cancel':
        await _tasks().cancel(_requireString(payload, 'runId'));
        return <String, Object?>{'status': 'aborted'};
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

  bool _isBinary(String path) {
    final String lower = path.toLowerCase();
    return <String>['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf']
        .any(lower.endsWith);
  }

  TaskService _tasks() {
    final TaskService? service = tasks;
    if (service == null) throw StateError('真实执行未接线（缺 TaskService）');
    return service;
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
