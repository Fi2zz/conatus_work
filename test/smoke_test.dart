import 'package:conatus/conatus.dart';
import 'package:test/test.dart';

void main() {
  test('产品层能装配最小 Context 并正常释放', () {
    final Context ctx = Context.root();
    expect(ctx.disposed, isFalse);
    ctx.dispose();
    expect(ctx.disposed, isTrue);
  });
}
