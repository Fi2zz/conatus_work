/// 哈希助手：产物的 `sha256` 指纹。
library;

import 'package:crypto/crypto.dart';

/// 按十六进制返回字节的 sha256。
String sha256Hex(List<int> bytes) => sha256.convert(bytes).toString();
