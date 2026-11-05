/// worker 进程启动：开发期跑 `dart run bin/worker.dart`，打包后跑内嵌 AOT。
library;

import 'dart:io';

import '../runner/worker_job.dart';

/// 一个已启动的 worker 进程。
abstract class WorkerProcess {
  /// 进程 id。
  int get pid;

  /// 退出码；进程结束时完成。
  Future<int> get exitCode;

  /// SIGTERM（Windows 回落 SIGKILL）。
  bool terminate();

  /// SIGKILL。
  bool kill();
}

/// 基于 `Process` 的实现。
class ProcessWorker implements WorkerProcess {
  ProcessWorker(this._process);

  final Process _process;

  @override
  int get pid => _process.pid;

  @override
  Future<int> get exitCode => _process.exitCode;

  @override
  bool terminate() => _process.kill();

  @override
  bool kill() => _process.kill(ProcessSignal.sigkill);
}

/// 启动 worker 的策略。
class WorkerLauncher {
  WorkerLauncher({
    required this.executable,
    this.prefixArgs = const <String>[],
    this.workingDirectory,
  });

  final String executable;
  final List<String> prefixArgs;
  final String? workingDirectory;

  /// 写作业文件并启动 worker；参数末尾是作业文件路径。
  Future<WorkerProcess> start(
    WorkerJob job, {
    required String jobPath,
    required Map<String, String> env,
  }) async {
    await job.write(jobPath);
    final Process process = await Process.start(
      executable,
      <String>[...prefixArgs, jobPath],
      environment: env,
      workingDirectory: workingDirectory,
    );
    return ProcessWorker(process);
  }

  /// 找到可用的 worker；返回 null 表示回落到进程内执行。
  ///
  /// 优先级：`CONATUS_WORK_WORKER` 指向的 AOT 文件 → 壳内打包的
  /// `runner_worker` → 显式开启的开发期 `dart run bin/worker.dart`。
  static WorkerLauncher? discover({
    required Map<String, String> env,
    String? executable,
  }) {
    final String? configured = env['CONATUS_WORK_WORKER'];
    if (configured != null && configured.isNotEmpty && configured != '1') {
      if (File(configured).existsSync()) {
        return WorkerLauncher(executable: configured);
      }
      return null;
    }
    final String? bundled = _bundledWorker(executable);
    if (bundled != null) {
      return WorkerLauncher(executable: bundled);
    }
    if (configured == '1' || env['CONATUS_WORK_WORKER_DEV'] == '1') {
      return _devWorker(Directory.current.path);
    }
    return null;
  }

  static String? _bundledWorker(String? executable) {
    final String exe = executable ?? Platform.resolvedExecutable;
    final String dir = File(exe).parent.path;
    final List<String> candidates = <String>[
      '$dir/runner_worker',
      '$dir/../Resources/worker/runner_worker',
      '$dir/../Resources/runner_worker',
    ];
    for (final String candidate in candidates) {
      if (File(candidate).existsSync()) return candidate;
    }
    return null;
  }

  static WorkerLauncher? _devWorker(String start) {
    final String? dart = _whichDart();
    if (dart == null) return null;
    Directory dir = Directory(start).absolute;
    for (int i = 0; i < 6; i += 1) {
      final File direct = File('${dir.path}/bin/worker.dart');
      if (direct.existsSync()) {
        return WorkerLauncher(
          executable: dart,
          prefixArgs: <String>['run', direct.path],
          workingDirectory: dir.path,
        );
      }
      final Directory parent = dir.parent;
      if (parent.path == dir.path) break;
      dir = parent;
    }
    return null;
  }

  static String? _whichDart() {
    try {
      final ProcessResult result = Process.runSync('which', <String>['dart']);
      if (result.exitCode != 0) return null;
      final String path = (result.stdout as String).trim();
      return path.isEmpty ? null : path;
    } on ProcessException {
      return null;
    }
  }
}
