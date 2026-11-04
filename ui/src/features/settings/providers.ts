export interface ProviderModel {
  id: string
  label: string
  priceInput?: number
  priceOutput?: number
}

export interface ProviderPreset {
  id: string
  name: string
  providerName: string
  baseUrl: string
  note: string
  models: ProviderModel[]
  priceInput: number
  priceOutput: number
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    providerName: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    note: 'OpenAI 兼容端点，默认按 DeepSeek 官方价预填。',
    models: [
      { id: 'deepseek-chat', label: 'deepseek-chat' },
      { id: 'deepseek-reasoner', label: 'deepseek-reasoner' },
    ],
    priceInput: 0.15,
    priceOutput: 0.6,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    providerName: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    note: '官方 OpenAI 兼容端点。',
    models: [
      { id: 'gpt-4.1', label: 'gpt-4.1', priceInput: 2, priceOutput: 8 },
      { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', priceInput: 0.4, priceOutput: 1.6 },
      { id: 'gpt-4o', label: 'gpt-4o', priceInput: 2.5, priceOutput: 10 },
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini', priceInput: 0.15, priceOutput: 0.6 },
      { id: 'o3-mini', label: 'o3-mini', priceInput: 1.1, priceOutput: 4.4 },
    ],
    priceInput: 2.5,
    priceOutput: 10,
  },
  {
    id: 'ark',
    name: '火山方舟（豆包）',
    providerName: 'ark',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    note: '需要先在方舟控制台创建推理接入点，把接入点 ID 作为模型 id。',
    models: [
      { id: 'doubao-seed-1-6-250615', label: 'Doubao Seed 1.6' },
      { id: 'doubao-1-5-pro-32k-250115', label: 'Doubao 1.5 Pro 32k' },
    ],
    priceInput: 0.8,
    priceOutput: 2,
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi',
    providerName: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    note: 'OpenAI 兼容端点。',
    models: [
      { id: 'kimi-k2-0711-preview', label: 'kimi-k2' },
      { id: 'moonshot-v1-8k', label: 'moonshot-v1-8k' },
      { id: 'moonshot-v1-32k', label: 'moonshot-v1-32k' },
    ],
    priceInput: 0.6,
    priceOutput: 2.5,
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    providerName: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    note: 'OpenAI 兼容端点。',
    models: [
      { id: 'glm-4.5', label: 'glm-4.5' },
      { id: 'glm-4.5-air', label: 'glm-4.5-air' },
      { id: 'glm-4-flash', label: 'glm-4-flash' },
    ],
    priceInput: 0.6,
    priceOutput: 2.2,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    providerName: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    note: '一个 Key 路由多家模型，价格以 OpenRouter 页面为准。',
    models: [
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
    ],
    priceInput: 3,
    priceOutput: 15,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    providerName: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    note: 'OpenAI 兼容端点，模型广场里的 id 可直接填。',
    models: [
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B' },
      { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
    ],
    priceInput: 0.35,
    priceOutput: 1.4,
  },
  {
    id: 'ollama',
    name: 'Ollama / 本地',
    providerName: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    note: '本地端点通常不需要 API Key；模型 id 用 ollama list 里的名字。',
    models: [
      { id: 'qwen3:8b', label: 'qwen3:8b' },
      { id: 'llama3.1:8b', label: 'llama3.1:8b' },
      { id: 'deepseek-r1:8b', label: 'deepseek-r1:8b' },
    ],
    priceInput: 0,
    priceOutput: 0,
  },
  {
    id: 'custom',
    name: '自定义',
    providerName: 'custom',
    baseUrl: '',
    note: '任意 OpenAI 兼容端点；baseUrl、模型 id 和价格都需要自己填。',
    models: [],
    priceInput: 0,
    priceOutput: 0,
  },
]

export function providerOf(id: string): ProviderPreset {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[PROVIDERS.length - 1]
}

export interface ProviderDraft {
  baseUrl: string
  model: string
  providerName: string
  priceInput: string
  priceOutput: string
}

const DRAFT_KEY = 'conatus.providerDrafts'

export function readDrafts(): Record<string, ProviderDraft> {
  try {
    const raw = globalThis.localStorage?.getItem(DRAFT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, ProviderDraft>) : {}
  } catch {
    return {}
  }
}

export function saveDraft(id: string, draft: ProviderDraft): void {
  const drafts = readDrafts()
  drafts[id] = { ...draft }
  globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify(drafts))
}
