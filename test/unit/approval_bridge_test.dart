import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/approval_bridge.dart';
import 'package:test/test.dart';

void main() {
  test('带路径参数的请求按工作区授权预放行', () async {
    final RunnerApproval approval = RunnerApproval(
      onRequest: (ApprovalRequest request) async => false,
    );
    final ApprovalRequest withPath = ApprovalRequest(
      id: 'a1',
      toolName: 'write',
      pathArgs: const <String>['out/report.md'],
    );
    final ApprovalRequest withoutPath = ApprovalRequest(
      id: 'a2',
      toolName: 'apply_patch',
    );
    expect(await approval.preapproved(withPath), isTrue);
    expect(await approval.preapproved(withoutPath), isFalse);
  });

  test('request 交给外部处理器并转发到 pending 流', () async {
    final ApprovalRequest request = ApprovalRequest(
      id: 'a3',
      toolName: 'apply_patch',
      arguments: const <String, Object?>{'patch': 'x'},
    );
    final RunnerApproval approval = RunnerApproval(
      onRequest: (ApprovalRequest value) async => value.id == 'a3',
    );
    final Future<ApprovalRequest> first = approval.pending.first;
    expect(await approval.request(request), isTrue);
    expect(await first, request);
    await approval.close();
  });
}
