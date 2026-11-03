import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { ApprovalRequest } from '@/bridge/types'

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
    <div data-testid="approval-bar" className="border-t border-warning/40 bg-warning/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px]">
            需要审批：<span className="font-mono">{request.name}</span>
            <span className="ml-2 rounded border border-warning/50 px-1 text-[10px] text-warning">
              风险 {request.riskLevel}
            </span>
          </p>
          <p className="truncate font-mono text-[10.5px] text-ink-muted">{request.args}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => void respond('deny')}
            className="rounded border border-line px-2 py-1 text-[11.5px]"
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={() => void respond('allow')}
            className="rounded bg-accent px-2 py-1 text-[11.5px] text-white"
          >
            允许
          </button>
        </div>
      </div>
    </div>
  )
}
