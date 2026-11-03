import 'dart:io';
import 'dart:math';

/// 受控本地资源服务：只读前端构建产物，只绑 loopback，首次请求必须带 token。
///
/// 首次带 token 的请求会换成 cookie 并重定向到 `/`，避免 token 留在地址栏；
/// 之后的静态资源请求凭 cookie 放行。路径一律规范化后校验是否仍在根目录内。
class AssetServer {
  AssetServer({required this.root, String? token})
    : _token = token ?? _newToken();

  /// 前端构建产物目录（`ui/dist`）。
  final Directory root;

  final String _token;
  HttpServer? _server;

  /// 本次会话的一次性 token。
  String get token => _token;

  /// 启动后的访问地址；未启动时为空。
  Uri? get uri {
    final HttpServer? server = _server;
    return server == null
        ? null
        : Uri.parse('http://127.0.0.1:${server.port}/?token=$_token');
  }

  /// 绑定随机端口并开始服务。产物目录缺失时抛 [StateError]。
  Future<void> start() async {
    if (!root.existsSync()) {
      throw StateError('找不到前端构建产物：${root.path}');
    }
    final HttpServer server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      0,
    );
    _server = server;
    server.listen(_handle);
  }

  /// 停止服务（已连接的请求会被强制关闭）。
  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
  }

  Future<void> _handle(HttpRequest request) async {
    final HttpResponse response = request.response;
    if (_acceptToken(request)) {
      response.headers.add(
        HttpHeaders.setCookieHeader,
        'conatus_token=$_token; Path=/; HttpOnly; SameSite=Strict',
      );
      response.statusCode = HttpStatus.found;
      response.headers.set(HttpHeaders.locationHeader, '/');
      await response.close();
      return;
    }
    if (!_hasCookie(request)) {
      response.statusCode = HttpStatus.forbidden;
      response.write('forbidden');
      await response.close();
      return;
    }
    final File? file = _resolve(request.uri.path);
    if (file == null) {
      response.statusCode = HttpStatus.notFound;
      response.write('not found');
      await response.close();
      return;
    }
    response.headers.contentType = _contentType(file.path);
    response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    await response.addStream(file.openRead());
    await response.close();
  }

  bool _acceptToken(HttpRequest request) =>
      request.uri.queryParameters['token'] == _token;

  bool _hasCookie(HttpRequest request) => request.cookies.any(
    (Cookie cookie) =>
        cookie.name == 'conatus_token' && cookie.value == _token,
  );

  File? _resolve(String path) {
    final String relative = path == '/' ? '/index.html' : path;
    final String normalized = Uri.parse(relative).normalizePath().path;
    if (normalized.contains('..')) return null;
    final File file = File('${root.path}$normalized');
    final String rootPath = root.absolute.path;
    if (!file.absolute.path.startsWith(rootPath)) return null;
    return file.existsSync() ? file : null;
  }

  ContentType _contentType(String path) {
    if (path.endsWith('.html')) return ContentType.html;
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      return ContentType('text', 'javascript', charset: 'utf-8');
    }
    if (path.endsWith('.css')) {
      return ContentType('text', 'css', charset: 'utf-8');
    }
    if (path.endsWith('.json')) return ContentType.json;
    if (path.endsWith('.svg')) return ContentType('image', 'svg+xml');
    if (path.endsWith('.png')) return ContentType('image', 'png');
    if (path.endsWith('.woff2')) return ContentType('font', 'woff2');
    return ContentType.binary;
  }
}

String _newToken() {
  final Random random = Random.secure();
  return List<String>.generate(
    16,
    (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
}
