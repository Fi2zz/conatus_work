import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { ModelConfig } from '@/bridge/types'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/state/ui-state'

interface ModelOption {
  id: string
  label: string
  priceInput?: number
  priceOutput?: number
}

/** WorkBuddy 式模型选择器：贴在输入框工具行，切换后写入宿主配置。 */
export function ModelPicker({ disabled = false }: { disabled?: boolean }): JSX.Element | null {
  const setModule = useUiStore((state) => state.setModule)
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ModelOption[]>([])
  const [providerName, setProviderName] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function read(): Promise<void> {
      // AppProvider 在子组件挂载后才 setTransport，首帧可能还拿不到宿主。
      if (!hasTransport() || typeof getTransport().readConfig !== 'function') {
        timer = window.setTimeout(() => void read(), 120)
        return
      }
      try {
        const result = await getTransport().readConfig()
        if (!cancelled && result.ok) setConfig(result.value)
      } catch {
        // 宿主暂时不可读时保持静默；下次连接/切换任务再试。
      }
    }

    void read()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent): void {
      if (!host.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const available =
    hasTransport() && typeof getTransport().readConfig === 'function' && getTransport().mode !== 'replay'
  if (!available || config === null) return null

  if (!config.configured) {
    return (
      <button
        type="button"
        data-testid="model-picker-trigger"
        onClick={() => setModule('settings')}
        className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-ink-muted hover:bg-panel-muted hover:text-ink"
      >
        选择模型
      </button>
    )
  }

  async function load(): Promise<void> {
    setError(null)
    if (options.length > 0) return
    try {
      const { providerIdFor, providerOf } = await import('@/features/settings/providers')
      const preset = providerOf(providerIdFor(config?.baseUrl, config?.providerName))
      const current = config?.model ?? ''
      const list = preset.models.some((model) => model.id === current)
        ? preset.models
        : [{ id: current, label: `${current}（自定义）` }, ...preset.models]
      setProviderName(preset.name)
      setOptions(list)
    } catch (cause) {
      setError(String(cause))
    }
  }

  async function toggle(): Promise<void> {
    if (disabled) return
    if (!open) await load()
    setOpen((value) => !value)
  }

  async function choose(option: ModelOption): Promise<void> {
    if (!config || option.id === config.model) {
      setOpen(false)
      return
    }
    setSaving(option.id)
    setError(null)
    try {
      const result = await getTransport().saveConfig({
        baseUrl: config.baseUrl ?? '',
        model: option.id,
        ...(config.providerName ? { providerName: config.providerName } : {}),
        ...(option.priceInput !== undefined ? { priceInput: option.priceInput } : {}),
        ...(option.priceOutput !== undefined ? { priceOutput: option.priceOutput } : {}),
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setConfig(result.value)
      setOpen(false)
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(null)
    }
  }

  const label = options.find((option) => option.id === config.model)?.label ?? config.model

  return (
    <div ref={host} className="relative min-w-0 shrink">
      <button
        type="button"
        data-testid="model-picker-trigger"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => void toggle()}
        title="选择模型（写入宿主配置，重启壳后生效）"
        className={cn(
          'flex max-w-[10rem] items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-ink-muted',
          'hover:bg-panel-muted hover:text-ink disabled:opacity-50',
          open && 'bg-panel-muted text-ink',
        )}
      >
        <span className="truncate">{label || '选择模型'}</span>
        <span aria-hidden className="text-[8px] text-ink-faint">
          ▼
        </span>
      </button>

      {open ? (
        <div
          data-testid="model-picker"
          className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md border border-line bg-panel p-1 shadow-panel"
        >
          <p className="px-2 py-1 text-[10px] text-ink-faint">模型 · {providerName || '当前服务商'}</p>
          <p className="px-2 pb-1 text-[9.5px] text-ink-faint">写入宿主配置；当前壳进程重启后使用新模型。</p>
          <ul className="max-h-64 overflow-auto">
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  data-testid="model-option"
                  aria-pressed={option.id === config.model}
                  disabled={saving !== null}
                  onClick={() => void choose(option)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-[11.5px]',
                    option.id === config.model ? 'bg-accent/10 text-accent' : 'hover:bg-panel-muted',
                  )}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {saving === option.id ? <span className="text-[9px]">切换中…</span> : null}
                  {option.id === config.model && saving !== option.id ? <span aria-hidden>✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setModule('settings')
            }}
            className="mt-1 w-full rounded-sm border-t border-line/70 px-2 py-1 text-left text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            服务商与模型设置 →
          </button>
          {error ? (
            <p data-testid="model-picker-error" className="px-2 py-1 text-[10px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
