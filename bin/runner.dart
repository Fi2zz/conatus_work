import 'dart:io';

import 'package:conatus_work/conatus_work.dart';

Future<void> main(List<String> args) async {
  // 显式退出：搜索 / 抓取客户端可能仍持有在途连接，等待事件循环自然结束会把
  // 进程吊住（超时路径实测可挂十几分钟）。CLI 是批处理进程，退出码即结论。
  exit(await runCli(args));
}
