/// worker 进程内的审批端口：请求写文件，决定从文件读回。
///
/// 宿主侧（`TaskService`）负责扫描 `requests/` 并写 `responses/`；worker 不直接
/// 接触 UI，因此进程模型下审批仍可工作。
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';

/// 基于文件的审批实现。
class FileApproval extends Approval {
  FileApproval({
    required this.runDir,
    this.timeout = const Duration(minutes: 5),
    this.poll = const Duration(milliseconds: 100),
  });

  /// 运行目录（`<runDir>/approvals` 下读写）。
  final String runDir;

  /// 等待用户决定的上限。
  final Duration timeout;

  /// 轮询间隔。
  final Duration poll;

  final StreamController<ApprovalRequest> _pending =
      StreamController<ApprovalRequest>.broadcast();

  @override
  Stream<ApprovalRequest> get pending => _pending.stream;

  @override
  Future<bool> request(ApprovalRequest request) async {
    if (!_pending.isClosed) _pending.add(request);
    final Directory root = Directory(
      '$runDir${Platform.pathSeparator}approvals',
    );
    final Directory requests = Directory(
      '${root.path}${Platform.pathSeparator}requests',
    );
    final Directory responses = Directory(
      '${root.path}${Platform.pathSeparator}responses',
    );
    await requests.create(recursive: true);
    await responses.create(recursive: true);
    final File requestFile = File(
      '${requests.path}${Platform.pathSeparator}${request.id}.json',
    );
    await requestFile.writeAsString(jsonEncode(request.toJson()), flush: true);
    final File responseFile = File(
      '${responses.path}${Platform.pathSeparator}${request.id}.json',
    );
    final DateTime deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      if (responseFile.existsSync()) {
        final bool allow = _decisionOf(responseFile);
        await _cleanup(requestFile, responseFile);
        return allow;
      }
      await Future<void>.delayed(poll);
    }
    await _cleanup(requestFile, responseFile);
    return false;
  }

  @override
  Future<bool> preapproved(ApprovalRequest request) async =>
      request.pathArgs.isNotEmpty;

  @override
  Future<void> close() async {
    if (!_pending.isClosed) await _pending.close();
  }

  bool _decisionOf(File file) {
    try {
      final Object? decoded = jsonDecode(file.readAsStringSync());
      return decoded is Map<String, Object?> && decoded['decision'] == 'allow';
    } on FormatException {
      return false;
    } on FileSystemException {
      return false;
    }
  }

  Future<void> _cleanup(File request, File response) async {
    try {
      if (request.existsSync()) await request.delete();
      if (response.existsSync()) await response.delete();
    } on FileSystemException {
      // 并发清理失败忽略。
    }
  }
}
