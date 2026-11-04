/// 宿主审批桥：把工具审批请求交给 UI，并等待允许 / 拒绝决定。
library;

import 'dart:async';

import 'package:conatus/conatus.dart';

import '../bridge/bridge_error.dart';

/// 审批相关命令的失败；[code] 直接写进桥接错误帧。
class ApprovalError extends BridgeError {
  const ApprovalError(super.code, super.message);
}

/// 把 [ApprovalRequest] 转给外部处理器，并把请求广播到 [pending] 流。
///
/// 工作区内的路径参数由 `RootedFileSystem` 兜底，这里直接预放行，避免每次
/// 读写都弹审批；高危且无路径参数的工具（如 `apply_patch`）才真正询问。
class RunnerApproval extends Approval {
  RunnerApproval({required this.onRequest});

  /// 外部处理器：返回 true 表示允许。
  final Future<bool> Function(ApprovalRequest request) onRequest;

  final StreamController<ApprovalRequest> _pending =
      StreamController<ApprovalRequest>.broadcast();

  @override
  Stream<ApprovalRequest> get pending => _pending.stream;

  @override
  Future<bool> request(ApprovalRequest request) {
    if (!_pending.isClosed) _pending.add(request);
    return onRequest(request);
  }

  @override
  Future<bool> preapproved(ApprovalRequest request) async =>
      request.pathArgs.isNotEmpty;

  @override
  Future<void> close() async {
    if (!_pending.isClosed) await _pending.close();
  }
}
