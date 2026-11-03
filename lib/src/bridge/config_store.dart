/// 模型配置的本地落盘：GUI 启动拿不到 shell 环境变量，必须有自己的配置来源。
///
/// 文件权限 600；Key 只在本地，不写进日志、不回传给前端明文。
library;

import 'dart:convert';
import 'dart:io';

import '../runner/llm_config.dart';

/// 一份可编辑的模型配置。
class WorkbenchConfig {
  const WorkbenchConfig({
    required this.baseUrl,
    required this.model,
    this.apiKey,
    this.providerName,
    this.priceInput,
    this.priceOutput,
  });

  /// OpenAI 兼容端点。
  final String baseUrl;

  /// 模型 id。
  final String model;

  /// API Key；可空（本地端点）。
  final String? apiKey;

  /// 展示名。
  final String? providerName;

  /// 输入单价（美元 / 百万 token）。
  final double? priceInput;

  /// 输出单价。
  final double? priceOutput;

  /// 转成 `llmConfigFromEnv` 认的环境变量形式。
  Map<String, String> toEnv() => <String, String>{
    'WORK_LLM_BASE_URL': baseUrl,
    'WORK_LLM_MODEL': model,
    if (apiKey != null && apiKey!.isNotEmpty) 'WORK_LLM_API_KEY': apiKey!,
    if (providerName != null && providerName!.isNotEmpty) 'WORK_LLM_NAME': providerName!,
    if (priceInput != null) 'WORK_LLM_PRICE_IN': '$priceInput',
    if (priceOutput != null) 'WORK_LLM_PRICE_OUT': '$priceOutput',
  };

  /// 给前端的视图：Key 只报「有没有」，不回明文。
  Map<String, Object?> toView() => <String, Object?>{
    'baseUrl': baseUrl,
    'model': model,
    'providerName': providerName ?? 'openai-compatible',
    'hasKey': apiKey != null && apiKey!.isNotEmpty,
    'priceInput': priceInput,
    'priceOutput': priceOutput,
  };

  Map<String, Object?> toJson() => <String, Object?>{
    ...toView(),
    if (apiKey != null && apiKey!.isNotEmpty) 'apiKey': apiKey,
  };

  static WorkbenchConfig? fromJson(Map<String, Object?> json) {
    final Object? baseUrl = json['baseUrl'];
    final Object? model = json['model'];
    if (baseUrl is! String || baseUrl.isEmpty || model is! String || model.isEmpty) {
      return null;
    }
    final Object? key = json['apiKey'];
    final Object? provider = json['providerName'];
    final Object? priceIn = json['priceInput'];
    final Object? priceOut = json['priceOutput'];
    return WorkbenchConfig(
      baseUrl: baseUrl,
      model: model,
      apiKey: key is String && key.isNotEmpty ? key : null,
      providerName: provider is String && provider.isNotEmpty ? provider : null,
      priceInput: priceIn is num ? priceIn.toDouble() : null,
      priceOutput: priceOut is num ? priceOut.toDouble() : null,
    );
  }
}

/// `~/.conatus-work/config.json` 的读写。
class ConfigStore {
  ConfigStore({required this.path});

  /// 配置文件位置。
  final String path;

  /// 读配置；文件缺失或内容不合法时返回 null。
  WorkbenchConfig? load() {
    final File file = File(path);
    if (!file.existsSync()) return null;
    try {
      final Object? decoded = jsonDecode(file.readAsStringSync());
      if (decoded is! Map<String, Object?>) return null;
      return WorkbenchConfig.fromJson(decoded);
    } on FormatException {
      return null;
    } on FileSystemException {
      return null;
    }
  }

  /// 写配置，并把文件权限收到 600。
  Future<void> save(WorkbenchConfig config) async {
    final File file = File(path);
    await file.parent.create(recursive: true);
    await file.writeAsString(jsonEncode(config.toJson()));
    await _restrictPermissions(file);
  }

  /// 删掉配置文件（「清除 Key」用）。
  Future<void> clear() async {
    final File file = File(path);
    if (file.existsSync()) await file.delete();
  }

  Future<void> _restrictPermissions(File file) async {
    try {
      await Process.run('chmod', <String>['600', file.path]);
    } on ProcessException {
      // 非 POSIX 环境忽略：配置里可能没有 Key。
    }
  }
}

/// 读取 shell 风格的环境文件（`export KEY=VALUE` 或 `KEY=VALUE`）。
///
/// 只认真认识的 `WORK_LLM_*` 键，其它一律忽略；文件缺失或读不了返回空表。
Map<String, String> parseEnvFile(String path) {
  final File file = File(path);
  if (!file.existsSync()) return <String, String>{};
  final Map<String, String> values = <String, String>{};
  try {
    for (final String raw in file.readAsLinesSync()) {
      final String line = raw.trim();
      if (line.isEmpty || line.startsWith('#')) continue;
      final String body = line.startsWith('export ') ? line.substring(7).trim() : line;
      final int index = body.indexOf('=');
      if (index <= 0) continue;
      final String key = body.substring(0, index).trim();
      if (!key.startsWith('WORK_LLM_')) continue;
      String value = body.substring(index + 1).trim();
      if (value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'")))) {
        value = value.substring(1, value.length - 1);
      }
      if (value.isNotEmpty) values[key] = value;
    }
  } on FileSystemException {
    return <String, String>{};
  }
  return values;
}

/// 合并配置来源，后者覆盖前者：进程环境 < 本地配置 < 环境文件。
Map<String, String> mergeEnv(
  Map<String, String> processEnv,
  WorkbenchConfig? config, {
  Map<String, String> envFile = const <String, String>{},
}) => <String, String>{
  ...processEnv,
  ...?config?.toEnv(),
  ...envFile,
};

/// 校验配置是否足以跑模型。
String? validateConfig(WorkbenchConfig? config) {
  if (config == null) return '还没有配置模型：在设置里填端点与模型';
  try {
    llmConfigFromEnv(config.toEnv());
  } on LlmConfigError catch (error) {
    return error.message;
  }
  return null;
}
