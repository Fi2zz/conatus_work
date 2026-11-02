import 'dart:io';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:test/test.dart';

void main() {
  final List<File> cards =
      Directory('tasks')
          .listSync()
          .whereType<File>()
          .where((File file) => file.path.endsWith('.json'))
          .toList()
        ..sort((File a, File b) => a.path.compareTo(b.path));

  test('tasks/ 下至少有冒烟卡与三条链的 v01', () {
    final Set<String> ids = <String>{
      for (final File file in cards) file.uri.pathSegments.last,
    };
    expect(
      ids,
      containsAll(<String>[
        'empty-smoke.json',
        'research-cited-report-v01.json',
        'csv-sales-analysis-v01.json',
        'folder-organize-v01.json',
      ]),
    );
  });

  for (final File file in cards) {
    test('任务卡 ${file.uri.pathSegments.last} 合法且 fixture 齐备', () async {
      final TaskSpec spec = await TaskSpec.load(file.path);
      expect(kTaskChains, contains(spec.chain));
      final String version = spec.id.split('-').last;
      final String fixtureRoot = 'tasks/fixtures/${spec.chain}/$version';
      for (final String input in spec.inputs) {
        expect(
          FileSystemEntity.typeSync('$fixtureRoot/$input'),
          isNot(FileSystemEntityType.notFound),
          reason: 'fixture 缺输入：$fixtureRoot/$input',
        );
      }
    });
  }
}
