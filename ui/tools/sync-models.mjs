#!/usr/bin/env node
// 从 models.dev 同步服务商与模型目录，生成 UI 用的静态快照。
// 用法：node tools/sync-models.mjs
// 产物：src/features/settings/models.generated.ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const output = join(here, '..', 'src', 'features', 'settings', 'models.generated.ts')

// 稳定 id 是 UI/本地草稿的键；models.dev id 只用于取数。
const PROVIDERS = [
  ['deepseek', 'deepseek', 'https://api.deepseek.com', 'DeepSeek'],
  ['openai', 'openai', 'https://api.openai.com/v1', 'OpenAI'],
  ['volcengine', 'volcengine', 'https://ark.cn-beijing.volces.com/api/v3', '火山方舟（豆包）'],
  ['moonshot', 'moonshotai', 'https://api.moonshot.ai/v1', 'Moonshot / Kimi'],
  ['zhipu', 'zhipuai', 'https://open.bigmodel.cn/api/paas/v4', '智谱 GLM'],
  ['openrouter', 'openrouter', 'https://openrouter.ai/api/v1', 'OpenRouter'],
  ['siliconflow', 'siliconflow', 'https://api.siliconflow.com/v1', '硅基流动'],
  ['alibaba', 'alibaba', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', '阿里云百炼'],
  ['groq', 'groq', 'https://api.groq.com/openai/v1', 'Groq'],
  ['mistral', 'mistral', 'https://api.mistral.ai/v1', 'Mistral'],
  ['xai', 'xai', 'https://api.x.ai/v1', 'xAI'],
  ['cerebras', 'cerebras', 'https://api.cerebras.ai/v1', 'Cerebras'],
  ['deepinfra', 'deepinfra', 'https://api.deepinfra.com/v1/openai', 'DeepInfra'],
  ['fireworks', 'fireworks-ai', 'https://api.fireworks.ai/inference/v1', 'Fireworks AI'],
  ['nvidia', 'nvidia', 'https://integrate.api.nvidia.com/v1', 'NVIDIA NIM'],
  ['ollama', 'ollama-cloud', 'https://ollama.com/v1', 'Ollama Cloud'],
  ['stepfun', 'stepfun', 'https://api.stepfun.com/v1', 'StepFun'],
]

const EXCLUDE = /embedding|embed|rerank|tts|whisper|transcribe|image|dall-e|moderation/i

function pickModels(provider) {
  const models = Object.values(provider.models ?? {})
    .filter((model) => {
      if (EXCLUDE.test(model.id) || EXCLUDE.test(model.name ?? '')) return false
      if (!model.cost || typeof model.cost.input !== 'number') return false
      const outputs = model.modalities?.output ?? []
      return outputs.includes('text') && (model.limit?.context ?? 0) > 0
    })
    .sort((left, right) => {
      const byDate = String(right.release_date ?? '').localeCompare(String(left.release_date ?? ''))
      return byDate !== 0 ? byDate : String(left.id).localeCompare(String(right.id))
    })
    .slice(0, 24)
  return models.map((model) => ({
    id: model.id,
    label: model.name ?? model.id,
    priceInput: model.cost.input,
    priceOutput: model.cost.output,
  }))
}

const response = await fetch('https://models.dev/api.json')
if (!response.ok) throw new Error(`models.dev ${response.status}`)
const catalog = await response.json()

const providers = []
for (const [id, sourceId, baseUrl, name] of PROVIDERS) {
  const provider = catalog[sourceId]
  if (!provider) {
    console.warn(`skip ${sourceId}: not found in models.dev`)
    continue
  }
  const models = pickModels(provider)
  if (models.length === 0) {
    console.warn(`skip ${sourceId}: no chat models`)
    continue
  }
  providers.push({
    id,
    name,
    providerName: id,
    baseUrl,
    note: `models.dev · ${provider.name}${provider.api ? '' : '（使用 OpenAI 兼容端点）'}`,
    models,
    priceInput: models[0].priceInput ?? 0,
    priceOutput: models[0].priceOutput ?? 0,
  })
}

const generatedAt = new Date().toISOString().slice(0, 10)
const body = `// 由 tools/sync-models.mjs 从 https://models.dev/api.json 生成，请勿手改。
// 更新：node tools/sync-models.mjs
// REASON: 生成的数据表，行数由 models.dev 目录决定，不按手写单文件行数约束拆。

export interface GeneratedModel {
  id: string
  label: string
  priceInput: number
  priceOutput: number
}

export interface GeneratedProvider {
  id: string
  name: string
  providerName: string
  baseUrl: string
  note: string
  models: GeneratedModel[]
  priceInput: number
  priceOutput: number
}

export const MODELS_SYNCED_AT = '${generatedAt}'

export const MODELS_DEV_PROVIDERS: GeneratedProvider[] = ${JSON.stringify(providers, null, 2)}
`
writeFileSync(output, body)
console.log(`wrote ${providers.length} providers, ${providers.reduce((n, p) => n + p.models.length, 0)} models -> ${output}`)
