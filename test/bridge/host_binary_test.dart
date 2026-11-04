import 'package:conatus_work/src/bridge/host.dart';
import 'package:test/test.dart';

void main() {
  test('Office 与图片 / PDF 走字节读取', () {
    for (final String ext in <String>[
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
    ]) {
      expect(binaryArtifact('out/report.$ext'), isTrue, reason: ext);
    }
  });

  test('文本产物仍按 utf8 读取', () {
    for (final String ext in <String>[
      'md',
      'json',
      'csv',
      'tsv',
      'html',
      'txt',
    ]) {
      expect(binaryArtifact('out/report.$ext'), isFalse, reason: ext);
    }
  });
}
