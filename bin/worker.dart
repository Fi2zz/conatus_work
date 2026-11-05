import 'dart:io';

import 'package:conatus_work/conatus_work.dart';

/// AOT worker 入口；参数是作业文件路径。
Future<void> main(List<String> args) async {
  exit(await runWorkerJob(args));
}
