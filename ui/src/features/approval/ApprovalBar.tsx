import { useState } from 'react'
import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { ApprovalRequest } from '@/bridge/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ApprovalBarProps {
  request: ApprovalRequest
}

export function ApprovalBar({ request }: ApprovalBarProps): JSX.Element {
  const [pending, setPending] = useState<'allow' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respond(decision: 'allow' | 'deny'): Promise<void> {
    setError(null)
    setPending(decision)
    try {
      const result = await getTransport().respondApproval(request.requestId, decision)
      if (!result.ok) setError(`提交失败：${result.error.message}`)
    } catch (cause) {
      setError(`提交失败：${String(cause)}`)
    } finally {
      setPending(null)
    }
  }

  return (
    <div data-testid="approval-bar" className="border-t border-warning/40 bg-warning/8 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11.5px]">
            <span className="font-medium">需要审批</span>
            <span className="font-mono">{request.name}</span>
            <Badge tone="warning">风险 {request.riskLevel}</Badge>
          </p>
          <p className="truncate font-mono text-[10px] text-ink-muted">{request.args}</p>
          {error ? (
            <p data-testid="approval-error" role="alert" className="mt-1 text-[10.5px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => void respond('deny')}
          >
            {pending === 'deny' ? '提交中…' : '拒绝'}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={pending !== null}
            onClick={() => void respond('allow')}
          >
            {pending === 'allow' ? '提交中…' : '允许'}
          </Button>
        </div>
      </div>
    </div>
  )
}
