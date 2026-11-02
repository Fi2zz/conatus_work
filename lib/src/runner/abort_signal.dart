/// 跨进程中断标志：运行器写 `abort.request`，执行中的进程轮询它。
library;

import 'dart:io';

/// 一次运行的中断信号。
class AbortSignal {
  AbortSignal(this.flagPath);

  /// 标志文件路径（`<runDir>/abort.request`）。
  final String flagPath;

  /// 是否已被请求中断。
  bool get requested => File(flagPath).existsSync();

  /// 清掉中断请求；resume 前消费陈旧标志。
  Future<void> clear() async {
    final File file = File(flagPath);
    if (file.existsSync()) await file.delete();
  }

  /// 写入中断请求；重复调用幂等。
  Future<void> request() async {
    final File file = File(flagPath);
    await file.parent.create(recursive: true);
    await file.writeAsString('');
  }
}

/// 进程是否仍活着（POSIX `kill -0`）。
bool pidAlive(int pid) {
  if (pid <= 0) return false;
  final ProcessResult result = Process.runSync('kill', <String>['-0', '$pid']);
  return result.exitCode == 0;
}
