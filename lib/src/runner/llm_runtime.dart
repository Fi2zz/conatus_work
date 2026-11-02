/// 把配置变成可用的模型接入。
library;

import 'package:conatus/conatus.dart';

import 'llm_config.dart';

/// 一次运行持有的模型运行时。
class LlmRuntime {
  LlmRuntime({required this.config, LlmProvider? provider})
    : provider = provider ?? _build(config);

  /// 环境变量解析出的配置。
  final LlmConfig config;

  /// 实际调用的 provider（测试可注入脚本化实现）。
  final LlmProvider provider;

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

  static LlmProvider _build(LlmConfig config) => FallbackLlm(<LlmProvider>[
    OpenAiCompatibleProvider(
      name: config.providerName,
      baseUrl: config.baseUrl,
      model: config.model,
      // 本地兼容端点通常不校验 Key；provider 要求非空，缺省用 `local` 占位。
      apiKey: config.apiKey ?? 'local',
    ),
  ]);
}
