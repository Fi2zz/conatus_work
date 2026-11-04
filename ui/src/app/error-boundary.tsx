import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { useUiStore } from '@/state/ui-state'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  message: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('界面渲染失败', error, info.componentStack)
  }

  private reset = (): void => {
    useUiStore.setState({
      module: 'work',
      commandOpen: false,
      settingsOpen: false,
      newTaskOpen: false,
      compareOpen: false,
      undoDialog: false,
      rightExpanded: false,
    })
    this.setState({ message: null })
  }

  render(): ReactNode {
    if (this.state.message !== null) {
      return (
        <div data-testid="render-error" className="p-6">
          <h1 className="text-[14px] font-semibold">界面渲染失败</h1>
          <p className="mt-1 text-[12px] text-ink-muted">{this.state.message}</p>
          <p className="mt-1 text-[11px] text-ink-muted">
            数据可能不符合契约；检查当前 fixture 的字段，或换一个回放数据。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              data-testid="error-reset"
              onClick={this.reset}
              className="rounded-md bg-accent px-2.5 py-1 text-[11.5px] text-white"
            >
              重置界面
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-line px-2.5 py-1 text-[11.5px]"
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
