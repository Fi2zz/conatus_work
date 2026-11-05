import { MODELS_DEV_PROVIDERS, MODELS_SYNCED_AT, type GeneratedProvider } from './models.generated'

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

/** 目录来自 models.dev；更新：node tools/sync-models.mjs。 */
export const PROVIDERS: ProviderPreset[] = [
  ...MODELS_DEV_PROVIDERS.map((provider: GeneratedProvider) => ({ ...provider })),
  {
    id: 'ollama-local',
    name: 'Ollama（本地）',
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

export { MODELS_SYNCED_AT }

export function providerOf(id: string): ProviderPreset {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[PROVIDERS.length - 1]
}

/** 用 baseUrl / providerName 反推本地服务商 id；找不到就归到自定义。 */
export function providerIdFor(baseUrl?: string, providerName?: string): string {
  const base = (baseUrl ?? '').replace(/\/+$/, '')
  const byBase = PROVIDERS.find((provider) => provider.baseUrl.replace(/\/+$/, '') === base)
  if (byBase) return byBase.id
  const byName = PROVIDERS.find((provider) => provider.providerName === providerName)
  return byName?.id ?? 'custom'
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
