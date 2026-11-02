/// `mkdir` 工具：在可写范围内递归建目录。
library;

import 'package:conatus/conatus.dart';

import 'rooted_fs.dart';

/// 递归创建目录；路径必须落在工作区可写前缀下。
class MkdirTool extends Tool {
  MkdirTool({required this.fs});

  /// 带读写边界的文件系统。
  final RootedFileSystem fs;

  @override
  String get name => 'mkdir';

  @override
  String get description => '创建目录（自动补齐父目录）。路径必须在可写范围内。';

  @override
  List<ParamSpec> get params => <ParamSpec>[
    ParamSpec.string('path', description: '目录路径（工作区相对路径）', required: true),
  ];

  @override
  Future<ToolResult> call(ToolContext context) async {
    final String path = context.str('path');
    try {
      await fs.mkdir(path);
      return ToolResult.success(
        '已创建目录：$path',
        value: <String, Object?>{'path': path},
      );
    } on FsError catch (error) {
      return ToolResult.failure(
        error.message,
        error: ToolError(error.code.code, error.message),
      );
    }
  }
}
