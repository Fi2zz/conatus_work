import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { ModelConfig } from '@/bridge/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MODELS_SYNCED_AT,
  PROVIDERS,
  providerOf,
  readDrafts,
  saveDraft,
  type ProviderPreset,
} from './providers'

interface Form {
  baseUrl: string
  model: string
  providerName: string
  apiKey: string
  priceInput: string
  priceOutput: string
}

function formOf(preset: ProviderPreset): Form {
  return {
    baseUrl: preset.baseUrl,
    model: preset.models[0]?.id ?? '',
    providerName: preset.providerName,
    apiKey: '',
    priceInput: preset.priceInput ? `${preset.priceInput}` : '',
    priceOutput: preset.priceOutput ? `${preset.priceOutput}` : '',
  }
}

function providerFor(config: ModelConfig): string {
  const base = (config.baseUrl ?? '').replace(/\/+$/, '')
  const byBase = PROVIDERS.find((item) => item.baseUrl.replace(/\/+$/, '') === base)
  if (byBase) return byBase.id
  const byName = PROVIDERS.find((item) => item.providerName === config.providerName)
  return byName?.id ?? 'custom'
}

function Field(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  testId: string
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-micro">{props.label}</span>
      <input
        data-testid={props.testId}
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-7 rounded-md border border-line bg-canvas px-2 text-[12px] outline-none placeholder:text-ink-faint focus:border-accent/60"
      />
    </label>
  )
}

export function ModelSettings(): JSX.Element {
  const [providerId, setProviderId] = useState('deepseek')
  const [form, setForm] = useState<Form>(() => formOf(providerOf('deepseek')))
  const [config, setConfig] = useState<ModelConfig>({ configured: false })
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!hasTransport()) return
    void getTransport()
      .readConfig()
      .then((result) => {
        if (!result.ok) return
        const value = result.value
        setConfig(value)
        if (!value.configured) return
        const id = providerFor(value)
        setProviderId(id)
        const preset = providerOf(id)
        setForm({
          baseUrl: value.baseUrl ?? preset.baseUrl,
          model: value.model ?? '',
          providerName: value.providerName ?? preset.providerName,
          apiKey: '',
          priceInput: value.priceInput ? `${value.priceInput}` : '',
          priceOutput: value.priceOutput ? `${value.priceOutput}` : '',
        })
      })
      .catch(() => undefined)
  }, [])

  const preset = providerOf(providerId)
  const models = preset.models
  const modelInPreset = models.some((model) => model.id === form.model)
  const sameProvider = config.configured && providerFor(config) === providerId

  function patch(changes: Partial<Form>): void {
    setForm((current) => ({ ...current, ...changes }))
  }

  function chooseProvider(id: string): void {
    // 切走前把非敏感字段留在本地草稿里；Key 只存在当前会话内存。
    saveDraft(providerId, {
      baseUrl: form.baseUrl,
      model: form.model,
      providerName: form.providerName,
      priceInput: form.priceInput,
      priceOutput: form.priceOutput,
    })
    const next = providerOf(id)
    const draft = readDrafts()[id]
    setProviderId(id)
    setForm({
      ...formOf(next),
      ...(draft ?? {}),
      apiKey: keys[id] ?? '',
    })
  }

  function chooseModel(id: string): void {
    if (id === '__custom__') {
      patch({ model: '' })
      return
    }
    const model = models.find((item) => item.id === id)
    patch({
      model: id,
      ...(model?.priceInput !== undefined ? { priceInput: `${model.priceInput}` } : {}),
      ...(model?.priceOutput !== undefined ? { priceOutput: `${model.priceOutput}` } : {}),
    })
  }

  function setKey(apiKey: string): void {
    patch({ apiKey })
    setKeys((current) => ({ ...current, [providerId]: apiKey }))
  }

  async function save(): Promise<void> {
    setStatus(null)
    const result = await getTransport().saveConfig({
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      providerName: form.providerName.trim() || preset.providerName,
      ...(Number(form.priceInput) > 0 ? { priceInput: Number(form.priceInput) } : {}),
      ...(Number(form.priceOutput) > 0 ? { priceOutput: Number(form.priceOutput) } : {}),
    })
    if (!result.ok) {
      setStatus(result.error.message)
      return
    }
    setConfig(result.value)
    patch({ apiKey: '' })
    saveDraft(providerId, {
      baseUrl: form.baseUrl,
      model: form.model,
      providerName: form.providerName,
      priceInput: form.priceInput,
      priceOutput: form.priceOutput,
    })
    setStatus('已保存')
  }

  async function test(): Promise<void> {
    if (!hasTransport()) {
      setStatus('没有宿主连接')
      return
    }
    setTesting(true)
    try {
      const result = await getTransport().readConfig()
      setStatus(
        result.ok
          ? result.value.configured
            ? `配置可读：${result.value.model ?? '未指定模型'}`
            : '尚未保存模型配置'
          : result.error.message,
      )
    } finally {
      setTesting(false)
    }
  }

  async function clear(): Promise<void> {
    const clearConfig = getTransport().clearConfig
    if (!clearConfig) {
      setStatus('当前宿主不支持清除配置')
      return
    }
    const result = await clearConfig.call(getTransport())
    if (!result.ok) {
      setStatus(result.error.message)
      return
    }
    setConfig({ configured: false })
    setForm(formOf(preset))
    setStatus('已清除模型配置')
  }

  return (
    <section data-testid="settings-section-model" className="flex flex-col gap-3 text-[12px]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12.5px] font-medium">模型与价格</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            选择服务商与模型；Key 只写入宿主，浏览器只保存非敏感草稿。
          </p>
        </div>
        <Badge tone={config.configured ? 'success' : 'danger'} dot>
          {config.configured ? '已配置' : '未配置'}
        </Badge>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label-micro">服务商</span>
        <select
          data-testid="settings-provider"
          value={providerId}
          onChange={(event) => chooseProvider(event.target.value)}
          className="h-7 rounded-md border border-line bg-canvas px-2 text-[12px] outline-none focus:border-accent/60"
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
        <span className="text-[10.5px] text-ink-faint">{preset.note}</span>
        <span className="text-[10px] text-ink-faint">目录同步自 models.dev（{MODELS_SYNCED_AT}）</span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label-micro">模型</span>
          <select
            data-testid="settings-model-select"
            value={modelInPreset ? form.model : '__custom__'}
            onChange={(event) => chooseModel(event.target.value)}
            className="h-7 rounded-md border border-line bg-canvas px-2 text-[12px] outline-none focus:border-accent/60"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
            <option value="__custom__">自定义模型…</option>
          </select>
        </label>
        <Field
          testId="settings-model"
          label="模型 id（可自定义）"
          value={form.model}
          onChange={(model) => patch({ model })}
          placeholder="deepseek-chat"
        />
      </div>

      <Field
        testId="settings-base-url"
        label="端点（baseUrl）"
        value={form.baseUrl}
        onChange={(baseUrl) => patch({ baseUrl })}
        placeholder="https://api.deepseek.com"
      />
      <Field
        testId="settings-api-key"
        label={sameProvider && config.hasKey ? 'API Key（留空则不改）' : `API Key · ${preset.name}`}
        type="password"
        value={form.apiKey}
        onChange={setKey}
        placeholder={sameProvider && config.hasKey ? '已保存，留空保持不变' : 'sk-...'}
      />
      <p className="text-[10.5px] text-ink-faint">
        宿主同一时间只保存一套生效配置；切换服务商后需要重新填该服务商的 Key。
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field
          testId="settings-price-in"
          label="输入单价 / 百万"
          value={form.priceInput}
          onChange={(priceInput) => patch({ priceInput })}
          placeholder="0.15"
        />
        <Field
          testId="settings-price-out"
          label="输出单价 / 百万"
          value={form.priceOutput}
          onChange={(priceOutput) => patch({ priceOutput })}
          placeholder="0.60"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {config.configured ? (
          <Button size="sm" variant="quiet" onClick={() => void clear()}>
            清除配置
          </Button>
        ) : (
          <span className="text-[10.5px] text-ink-muted">未配置时任务会直接报错，不会跑空壳。</span>
        )}
        <div className="flex gap-2">
          <Button size="sm" data-testid="settings-test" disabled={testing} onClick={() => void test()}>
            {testing ? '测试中…' : '测试连接'}
          </Button>
          <Button size="sm" variant="primary" data-testid="settings-save" onClick={() => void save()}>
            保存
          </Button>
        </div>
      </div>
      {status ? (
        <p
          data-testid="settings-status"
          className={status.startsWith('已') || status.startsWith('配置') ? 'text-[11px] text-success' : 'text-[11px] text-danger'}
        >
          {status}
        </p>
      ) : null}
    </section>
  )
}
