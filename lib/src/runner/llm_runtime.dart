/// 把配置变成可用的模型接入。
library;

import 'dart:math';

import 'package:conatus/conatus.dart';

import 'llm_config.dart';

/// 一次运行持有的模型运行时。
class LlmRuntime {
  factory LlmRuntime({
    required LlmConfig config,
    LlmProvider? provider,
    String? sessionId,
  }) {
    final String id = sessionId ?? newSessionId();
    return LlmRuntime._(config, provider ?? _build(config, id), id);
  }

  LlmRuntime._(this.config, this.provider, this.sessionId);

  /// 环境变量解析出的配置。
  final LlmConfig config;

  /// 实际调用的 provider（测试可注入脚本化实现）。
  final LlmProvider provider;

  /// 随请求发送的会话 id（OpenCode Go 强制要求 `x-opencode-session`）。
  final String sessionId;

  /// 写进 `run.json.model` 的标签。
  String get modelLabel => config.label;

  /// 单价齐全时折算成本；缺一项返回 null（不猜价格）。
  ModelRate? get rate {
    final double? input = config.priceInput;
    final double? output = config.priceOutput;
    if (input == null || output == null) return null;
    return ModelRate(
      inputPerMillion: input,
      cachedPerMillion: input,
      outputPerMillion: output,
    );
  }

  static LlmProvider _build(LlmConfig config, String sessionId) =>
      FallbackLlm(<LlmProvider>[
        OpenAiCompatibleProvider(
          name: config.providerName,
          baseUrl: config.baseUrl,
          model: config.model,
          // 本地兼容端点通常不校验 Key；provider 要求非空，缺省用 `local` 占位。
          apiKey: config.apiKey ?? 'local',
          // OpenCode Go 要求稳定的会话 id；其它兼容端点会忽略未知头。
          headersProvider: () => <String, String>{
            'x-opencode-session': sessionId,
          },
        ),
      ]);
}

/// 生成 `ses_<32 hex>` 形式的会话 id。
String newSessionId() {
  final Random random = Random.secure();
  final String hex = List<String>.generate(
    16,
    (int _) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
  return 'ses_$hex';
}
