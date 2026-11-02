/// `move` 工具：在可写范围内移动文件或目录。
library;

import 'package:conatus/conatus.dart';

import 'rooted_fs.dart';

/// 移动文件或目录；目标已存在时不覆盖。
class MoveTool extends Tool {
  MoveTool({required this.fs});

  /// 带读写边界的文件系统。
  final RootedFileSystem fs;

  @override
  String get name => 'move';

  @override
  String get description => '移动文件或目录（不覆盖已存在目标）。源与目标都必须在可写范围内。';

  @override
  ToolRisk get riskLevel => ToolRisk.medium;

  @override
  List<String> get pathParams => const <String>['from', 'to'];

  @override
  List<ParamSpec> get params => <ParamSpec>[
    ParamSpec.string('from', description: '源路径', required: true),
    ParamSpec.string('to', description: '目标路径', required: true),
  ];

  @override
  Future<ToolResult> call(ToolContext context) async {
    final String from = context.str('from');
    final String to = context.str('to');
    try {
      final MoveResult result = await fs.move(from, to);
      return ToolResult.success(
        '已移动：$from → $to（${result.bytes} 字节，sha256=${result.sha256 ?? '目录'}）',
        value: <String, Object?>{
          'from': result.fromPath,
          'to': result.toPath,
          'bytes': result.bytes,
          'sha256': result.sha256,
        },
      );
    } on FsError catch (error) {
      return ToolResult.failure(
        error.message,
        error: ToolError(error.code.code, error.message),
      );
    }
  }
}
