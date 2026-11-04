import { useState } from 'react'
import type { JSX } from 'react'

import { Button } from '@/components/ui/button'
import { useUiStore } from '@/state/ui-state'

const VERSION = '0.1.0'

export function AboutSettings(): JSX.Element {
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const [status, setStatus] = useState<string | null>(null)

  function diagnostics(): string {
    return [
      `Conatus Work UI ${VERSION}`,
      `mode=${import.meta.env.MODE}`,
      `ua=${globalThis.navigator?.userAgent ?? 'unknown'}`,
      `theme=${document.documentElement.dataset.theme ?? 'auto'}`,
    ].join('\n')
  }

  async function copy(): Promise<void> {
    try {
      await globalThis.navigator?.clipboard?.writeText(diagnostics())
      setStatus('诊断信息已复制')
    } catch {
      setStatus('剪贴板不可用，诊断信息未复制')
    }
  }

  return (
    <section data-testid="settings-about" className="flex flex-col gap-3 text-[12px]">
      <div>
        <p className="text-[12.5px] font-medium">Conatus Work</p>
        <p data-testid="settings-version" className="mt-0.5 font-mono text-[11px] text-ink-muted">
          UI {VERSION} · 本地优先工作台
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-ink-muted">运行形态</dt>
        <dd>{import.meta.env.MODE === 'development' ? '开发（Vite HMR）' : '生产构建'}</dd>
        <dt className="text-ink-muted">桥接协议</dt>
        <dd>v1 · JSON 帧</dd>
        <dt className="text-ink-muted">数据目录</dt>
        <dd className="font-mono text-[10.5px]">~/.conatus-work</dd>
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3">
        <Button size="sm" data-testid="settings-update" onClick={() => setStatus('已是最新版本（原型检查）')}>
          检查更新
        </Button>
        <Button size="sm" data-testid="settings-copy-diag" onClick={() => void copy()}>
          复制诊断信息
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setShortcutsOpen(true)}>
          快捷键
        </Button>
      </div>
      {status ? (
        <p data-testid="settings-about-status" className="text-[11px] text-ink-muted">
          {status}
        </p>
      ) : null}
    </section>
  )
}
