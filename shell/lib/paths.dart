import 'dart:io';

/// 候选仓库根目录：当前工作目录，以及可执行文件向上的若干层。
///
/// 桌面应用从 Finder 启动时 cwd 是 `/`，`flutter run` 启动时也可能不在项目目录，
/// 所以不能依赖相对路径；从可执行文件位置向上找 `ui/dist` 才稳。
List<String> candidateRoots({
  required String cwd,
  required String executable,
  int depth = 10,
}) {
  final List<String> roots = <String>[];
  Directory fromCwd = Directory(cwd);
  for (int i = 0; i < depth; i += 1) {
    roots.add(fromCwd.path);
    final Directory parent = fromCwd.parent;
    if (parent.path == fromCwd.path) break;
    fromCwd = parent;
  }
  Directory current = File(executable).parent;
  for (int i = 0; i < depth; i += 1) {
    roots.add(current.path);
    final Directory parent = current.parent;
    if (parent.path == current.path) break;
    current = parent;
  }
  return roots;
}

/// 第一个含有 `ui/dist` 的根目录对应的构建产物路径。
String? findUiDir(List<String> roots) {
  for (final String root in roots) {
    final String candidate = '$root/ui/dist';
    if (File('$candidate/index.html').existsSync()) return candidate;
  }
  return null;
}

/// 第一个含有 `var/runs` 的根目录。
String? findRunsDir(List<String> roots) {
  for (final String root in roots) {
    final String candidate = '$root/var/runs';
    if (Directory(candidate).existsSync()) return candidate;
  }
  return null;
}
