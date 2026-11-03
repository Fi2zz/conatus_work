/// 模型配置：一律从环境变量读，Key 不落盘。
library;

/// 模型配置不完整或非法。
class LlmConfigError implements Exception {
  const LlmConfigError(this.message);

  /// 人可读的失败说明。
  final String message;

  @override
  String toString() => 'LlmConfigError: $message';
}

/// 一次运行要用的模型配置。
class LlmConfig {
  const LlmConfig({
    required this.baseUrl,
    required this.model,
    this.apiKey,
    this.providerName = 'openai-compatible',
    this.priceInput,
    this.priceOutput,
    this.priceCached,
  });

  /// OpenAI 兼容端点。
  final String baseUrl;

  /// 模型 id。
  final String model;

  /// API Key；本地兼容端点可为空。
  final String? apiKey;

  /// 展示名。
  final String providerName;

  /// 输入单价（美元 / 百万 token）；与 [priceOutput] 成对出现。
  final double? priceInput;

  /// 输出单价（美元 / 百万 token）。
  final double? priceOutput;

  /// 缓存命中输入的单价；缺省沿用 [priceInput]。
  final double? priceCached;

  /// 写进 `run.json.model` 的标签。
  String get label => '$providerName/$model';
}

/// 从环境变量解析配置：`baseUrl` 与 `model` 必填，其余可选。
LlmConfig llmConfigFromEnv(Map<String, String> env) {
  final String? baseUrl = _value(env['WORK_LLM_BASE_URL']);
  final String? model = _value(env['WORK_LLM_MODEL']);
  if (baseUrl == null) throw const LlmConfigError('缺少 WORK_LLM_BASE_URL');
  if (model == null) throw const LlmConfigError('缺少 WORK_LLM_MODEL');
  final double? priceInput = _price(env['WORK_LLM_PRICE_IN'], 'IN');
  final double? priceOutput = _price(env['WORK_LLM_PRICE_OUT'], 'OUT');
  final double? priceCached = _price(env['WORK_LLM_PRICE_CACHED'], 'CACHED');
  if ((priceInput == null) != (priceOutput == null)) {
    throw const LlmConfigError('WORK_LLM_PRICE_IN 与 WORK_LLM_PRICE_OUT 必须成对出现');
  }
  return LlmConfig(
    baseUrl: baseUrl,
    model: model,
    apiKey: _value(env['WORK_LLM_API_KEY']),
    providerName: _value(env['WORK_LLM_NAME']) ?? 'openai-compatible',
    priceInput: priceInput,
    priceOutput: priceOutput,
    priceCached: priceCached,
  );
}

String? _value(String? raw) {
  final String? trimmed = raw?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

double? _price(String? raw, String name) {
  final String? value = _value(raw);
  if (value == null) return null;
  final double? parsed = double.tryParse(value);
  if (parsed == null || parsed < 0) {
    throw LlmConfigError('WORK_LLM_PRICE_$name 不是合法单价：$value');
  }
  return parsed;
}
