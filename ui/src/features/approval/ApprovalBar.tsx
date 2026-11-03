import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { ApprovalRequest } from '@/bridge/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ApprovalBarProps {
  runId: string
  request: ApprovalRequest
}

export function ApprovalBar({ runId, request }: ApprovalBarProps): JSX.Element {
  async function respond(decision: 'allow' | 'deny'): Promise<void> {
    await getTransport().respondApproval(request.requestId, decision)
    void runId
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
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" onClick={() => void respond('deny')}>
            拒绝
          </Button>
          <Button size="sm" variant="primary" onClick={() => void respond('allow')}>
            允许
          </Button>
        </div>
      </div>
    </div>
  )
}
