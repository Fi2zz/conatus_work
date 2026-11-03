import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

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

  render(): ReactNode {
    if (this.state.message !== null) {
      return (
        <div data-testid="render-error" className="p-6">
          <h1 className="text-[14px] font-semibold">界面渲染失败</h1>
          <p className="mt-1 text-[12px] text-ink-muted">{this.state.message}</p>
          <p className="mt-1 text-[11px] text-ink-muted">
            数据可能不符合契约；检查当前 fixture 的字段，或换一个回放数据。
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
