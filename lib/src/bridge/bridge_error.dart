/// 桥接命令的失败；[code] 直接写进错误帧。
library;

/// `NOT_FOUND` / `PRUNED` / `STALE_TURN` / `DENIED` / `INTERNAL`。
class BridgeError implements Exception {
  const BridgeError(this.code, this.message);

  /// 错误码。
  final String code;

  /// 人可读说明。
  final String message;

  @override
  String toString() => 'BridgeError($code): $message';
}
