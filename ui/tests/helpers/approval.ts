import type { BridgeTransport } from '@/bridge/transport'
import { setTransport } from '@/bridge/transport-store'
import type { ApprovalRequest } from '@/bridge/types'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'

import { seedRun } from './state'

const pending: ApprovalRequest = {
  requestId: 'req-1',
  callId: 'c1',
  name: 'move',
  args: '{"from":"inbox/a.docx","to":"inbox/organized/docx/a.docx"}',
  riskLevel: 'high',
}

export function seedApproval(): void {
  const run = seedRun([{ kind: 'user', id: 'u1', at: 0, text: '整理收件箱' }], { status: 'running' })
  useWorkbenchStore.setState({ runs: { 'run-a': { ...run, approval: pending } } })
  useUiStore.setState({ rightTab: 'changes', undoDialog: false, commandOpen: false, composerDraft: '' })

  const transport = {
    async respondApproval(requestId: string, decision: 'allow' | 'deny') {
      useWorkbenchStore.getState().apply({
        seq: 99,
        at: 10,
        type: 'approval/resolved',
        runId: 'run-a',
        data: { requestId, name: 'move', decision },
      })
      return { ok: true as const, value: undefined }
    },
    async sendMessage() {
      return { ok: true as const, value: undefined }
    },
    async cancelTask() {
      return { ok: true as const, value: { status: 'aborted' as const } }
    },
  } as unknown as BridgeTransport
  setTransport(transport)
}
