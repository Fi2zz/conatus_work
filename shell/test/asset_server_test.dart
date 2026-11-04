import 'dart:convert';
import 'dart:io';

import 'package:conatus_work_shell/asset_server.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late Directory root;
  late AssetServer server;
  late HttpClient client;

  setUp(() async {
    root = Directory.systemTemp.createTempSync('asset_');
    File('${root.path}/index.html').writeAsStringSync('<h1>ok</h1>');
    Directory('${root.path}/assets').createSync();
    File('${root.path}/assets/app.js').writeAsStringSync('console.log(1)');
    server = AssetServer(root: root, token: 'tok');
    await server.start();
    client = HttpClient();
  });

  tearDown(() async {
    client.close(force: true);
    await server.stop();
    root.deleteSync(recursive: true);
  });

  Future<HttpClientResponse> get(
    String pathAndQuery, {
    bool followRedirects = true,
  }) async {
    final HttpClientRequest request = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.uri!.port}$pathAndQuery'),
    );
    request.followRedirects = followRedirects;
    return request.close();
  }

  test('无 token 且无 cookie 的请求被拒绝', () async {
    final HttpClientResponse response = await get('/');
    expect(response.statusCode, HttpStatus.forbidden);
    await response.drain<void>();
  });

  test('首次带 token 换成 cookie 并重定向', () async {
    final HttpClientResponse response = await get(
      '/?token=tok',
      followRedirects: false,
    );
    expect(response.statusCode, HttpStatus.found);
    expect(response.headers.value(HttpHeaders.locationHeader), '/');
    final String? cookie = response.headers.value(HttpHeaders.setCookieHeader);
    expect(cookie, contains('conatus_token=tok'));
    await response.drain<void>();
  });

  test('错误的 token 不放行', () async {
    final HttpClientResponse response = await get('/?token=wrong');
    expect(response.statusCode, HttpStatus.forbidden);
    await response.drain<void>();
  });

  test('带 cookie 可以取到页面与静态资源', () async {
    final HttpClientRequest page = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.uri!.port}/'),
    );
    page.cookies.add(Cookie('conatus_token', 'tok'));
    final HttpClientResponse pageResponse = await page.close();
    expect(pageResponse.statusCode, HttpStatus.ok);
    expect(await pageResponse.transform(utf8.decoder).join(), '<h1>ok</h1>');

    final HttpClientRequest asset = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.uri!.port}/assets/app.js'),
    );
    asset.cookies.add(Cookie('conatus_token', 'tok'));
    final HttpClientResponse assetResponse = await asset.close();
    expect(assetResponse.statusCode, HttpStatus.ok);
    expect(assetResponse.headers.contentType?.mimeType, 'text/javascript');
    await assetResponse.drain<void>();
  });

  test('响应带 CSP 与基础安全头', () async {
    final HttpClientRequest page = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.uri!.port}/'),
    );
    page.cookies.add(Cookie('conatus_token', 'tok'));
    final HttpClientResponse response = await page.close();
    final String? csp = response.headers.value('content-security-policy');
    expect(csp, contains("default-src 'self'"));
    expect(csp, contains("object-src 'none'"));
    expect(csp, contains("frame-ancestors 'none'"));
    expect(response.headers.value('x-content-type-options'), 'nosniff');
    expect(response.headers.value('referrer-policy'), 'no-referrer');
    await response.drain<void>();

    final HttpClientResponse denied = await get('/');
    expect(denied.statusCode, HttpStatus.forbidden);
    expect(denied.headers.value('content-security-policy'), contains("default-src 'self'"));
    await denied.drain<void>();
  });

  test('越界路径不会穿透到根目录之外', () async {
    final HttpClientRequest request = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.uri!.port}/../pubspec.yaml'),
    );
    request.cookies.add(Cookie('conatus_token', 'tok'));
    final HttpClientResponse response = await request.close();
    expect(response.statusCode, HttpStatus.notFound);
    await response.drain<void>();
  });

  test('产物目录不存在时启动失败', () async {
    final AssetServer missing = AssetServer(
      root: Directory('${root.path}/nope'),
    );
    expect(missing.start, throwsA(isA<StateError>()));
  });
}
