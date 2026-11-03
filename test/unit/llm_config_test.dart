import 'package:conatus_work/src/runner/llm_config.dart';
import 'package:test/test.dart';

void main() {
  test('缺 baseUrl / model 直接拒绝', () {
    expect(
      () => llmConfigFromEnv(<String, String>{'WORK_LLM_MODEL': 'm'}),
      throwsA(isA<LlmConfigError>()),
    );
    expect(
      () => llmConfigFromEnv(<String, String>{'WORK_LLM_BASE_URL': 'http://x'}),
      throwsA(isA<LlmConfigError>()),
    );
  });

  test('齐全时解析，apiKey 可空，label 拼接', () {
    final LlmConfig local = llmConfigFromEnv(<String, String>{
      'WORK_LLM_BASE_URL': 'http://localhost:11434/v1',
      'WORK_LLM_MODEL': 'qwen2.5',
    });
    expect(local.apiKey, isNull);
    expect(local.label, 'openai-compatible/qwen2.5');

    final LlmConfig remote = llmConfigFromEnv(<String, String>{
      'WORK_LLM_BASE_URL': 'https://ark.example/v3',
      'WORK_LLM_MODEL': 'doubao-seed',
      'WORK_LLM_API_KEY': 'sk-test',
      'WORK_LLM_NAME': 'ark',
      'WORK_LLM_PRICE_IN': '0.8',
      'WORK_LLM_PRICE_OUT': '2.0',
    });
    expect(remote.label, 'ark/doubao-seed');
    expect(remote.priceInput, 0.8);
    expect(remote.priceOutput, 2.0);
  });

  test('价格只给一个视为配置错误', () {
    expect(
      () => llmConfigFromEnv(<String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
        'WORK_LLM_PRICE_IN': '1',
      }),
      throwsA(isA<LlmConfigError>()),
    );
  });

  test('缓存单价可选，缺省沿用输入单价', () {
    final LlmConfig withCached = llmConfigFromEnv(<String, String>{
      'WORK_LLM_BASE_URL': 'http://x',
      'WORK_LLM_MODEL': 'm',
      'WORK_LLM_PRICE_IN': '0.15',
      'WORK_LLM_PRICE_OUT': '0.6',
      'WORK_LLM_PRICE_CACHED': '0.003',
    });
    expect(withCached.priceCached, 0.003);
    final LlmConfig without = llmConfigFromEnv(<String, String>{
      'WORK_LLM_BASE_URL': 'http://x',
      'WORK_LLM_MODEL': 'm',
      'WORK_LLM_PRICE_IN': '0.15',
      'WORK_LLM_PRICE_OUT': '0.6',
    });
    expect(without.priceCached, isNull);
  });
}
