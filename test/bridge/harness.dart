import 'dart:io';

const String projectionInput = 'test/fixtures/projection/organize-v01';
const String committedFixture = 'ui/src/fixtures/runs/organize-v01.json';

/// 把自包含的投影输入复制到临时 runs 根目录下，返回该目录。
Directory prepareRunsRoot(String runId) {
  final Directory root = Directory.systemTemp.createTempSync('work-runs-');
  final Directory target = Directory('${root.path}/$runId')..createSync();
  for (final FileSystemEntity entity in Directory(projectionInput).listSync(recursive: true)) {
    if (entity is! File) continue;
    final String relative = entity.path.substring(projectionInput.length + 1);
    final File copy = File('${target.path}/$relative');
    copy.parent.createSync(recursive: true);
    copy.writeAsStringSync(entity.readAsStringSync());
  }
  return root;
}
