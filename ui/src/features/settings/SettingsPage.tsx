import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { ModelConfig } from '@/bridge/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/state/workbench-store'

interface Form {
  baseUrl: string
  model: string
  providerName: string
  apiKey: string
  priceInput: string
  priceOutput: string
}

const EMPTY: Form = { baseUrl: '', model: '', providerName: '', apiKey: '', priceInput: '', priceOutput: '' }

function toForm(config: ModelConfig): Form {
  return {
    baseUrl: config.baseUrl ?? '',
    model: config.model ?? '',
    providerName: config.providerName === 'openai-compatible' ? '' : (config.providerName ?? ''),
    apiKey: '',
    priceInput: config.priceInput ? `${config.priceInput}` : '',
    priceOutput: config.priceOutput ? `${config.priceOutput}` : '',
  }
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

export function SettingsPage(): JSX.Element {
  const keep = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId]?.checkpoints.keep : undefined)) ?? 5
  const [config, setConfig] = useState<ModelConfig>({ configured: false })
  const [form, setForm] = useState<Form>(EMPTY)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!hasTransport()) return
    const transport = getTransport()
    if (typeof transport.readConfig !== 'function') return
    void transport
      .readConfig()
      .then((result) => {
        if (!result.ok) return
        setConfig(result.value)
        setForm(toForm(result.value))
      })
      .catch(() => undefined)
  }, [])

  async function save(): Promise<void> {
    setStatus(null)
    const result = await getTransport().saveConfig({
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      ...(form.providerName.trim() ? { providerName: form.providerName.trim() } : {}),
      ...(Number(form.priceInput) > 0 ? { priceInput: Number(form.priceInput) } : {}),
      ...(Number(form.priceOutput) > 0 ? { priceOutput: Number(form.priceOutput) } : {}),
    })
    if (!result.ok) {
      setStatus(result.error.message)
      return
    }
    setConfig(result.value)
    setForm((current) => ({ ...current, apiKey: '' }))
    setStatus('已保存')
  }

  return (
    <div data-testid="settings-page" className="flex flex-col gap-3 p-1 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="label-micro">模型</span>
        <Badge tone={config.configured ? 'success' : 'danger'} dot>
          {config.configured ? '已配置' : '未配置'}
        </Badge>
      </div>

      <Field
        testId="settings-base-url"
        label="端点（baseUrl）"
        value={form.baseUrl}
        onChange={(baseUrl) => setForm((current) => ({ ...current, baseUrl }))}
        placeholder="https://opencode.ai/zen/go/v1"
      />
      <Field
        testId="settings-model"
        label="模型 id"
        value={form.model}
        onChange={(model) => setForm((current) => ({ ...current, model }))}
        placeholder="deepseek-v4.1-flash"
      />
      <Field
        testId="settings-api-key"
        label={config.hasKey ? 'API Key（留空则不改）' : 'API Key'}
        type="password"
        value={form.apiKey}
        onChange={(apiKey) => setForm((current) => ({ ...current, apiKey }))}
        placeholder={config.hasKey ? '已保存，留空保持不变' : 'sk-...'}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          testId="settings-price-in"
          label="输入单价 / 百万"
          value={form.priceInput}
          onChange={(priceInput) => setForm((current) => ({ ...current, priceInput }))}
          placeholder="0.15"
        />
        <Field
          testId="settings-price-out"
          label="输出单价 / 百万"
          value={form.priceOutput}
          onChange={(priceOutput) => setForm((current) => ({ ...current, priceOutput }))}
          placeholder="0.60"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-ink-muted">保存在 ~/.conatus-work/config.json（权限 600）</span>
        <Button size="sm" variant="primary" data-testid="settings-save" onClick={() => void save()}>
          保存
        </Button>
      </div>
      {status ? (
        <p data-testid="settings-status" className={status === '已保存' ? 'text-[11px] text-success' : 'text-[11px] text-danger'}>
          {status}
        </p>
      ) : null}

      <div className="mt-1 flex items-center justify-between border-t border-line/70 pt-2 text-[11px]">
        <span className="text-ink-muted">检查点保留轮次</span>
        <span data-testid="settings-keep" className="tnum">
          {keep}
        </span>
      </div>
    </div>
  )
}
