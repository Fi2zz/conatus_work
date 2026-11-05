import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/file_approval.dart';
import 'package:test/test.dart';

void main() {
  late Directory tmp;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('approval_');
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  ApprovalRequest request() => ApprovalRequest(
    id: 'req-1',
    toolName: 'apply_patch',
    arguments: const <String, Object?>{'patch': 'x'},
  );

  Future<File> waitRequest() async {
    final File file = File('${tmp.path}/approvals/requests/req-1.json');
    for (int i = 0; i < 100; i += 1) {
      if (file.existsSync()) return file;
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    throw StateError('审批请求未落盘');
  }

  test('allow 决定返回 true', () async {
    final FileApproval approval = FileApproval(
      runDir: tmp.path,
      poll: const Duration(milliseconds: 10),
      timeout: const Duration(seconds: 2),
    );
    final Future<bool> result = approval.request(request());
    final File requestFile = await waitRequest();
    expect(requestFile.existsSync(), isTrue);
    File(
      '${tmp.path}/approvals/responses/req-1.json',
    ).writeAsStringSync(jsonEncode(<String, Object?>{'decision': 'allow'}));
    expect(await result, isTrue);
    await approval.close();
  });

  test('deny 决定返回 false', () async {
    final FileApproval approval = FileApproval(
      runDir: tmp.path,
      poll: const Duration(milliseconds: 10),
      timeout: const Duration(seconds: 2),
    );
    final Future<bool> result = approval.request(request());
    await waitRequest();
    File(
      '${tmp.path}/approvals/responses/req-1.json',
    ).writeAsStringSync(jsonEncode(<String, Object?>{'decision': 'deny'}));
    expect(await result, isFalse);
    await approval.close();
  });
}
