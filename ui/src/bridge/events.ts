import type {
  ApprovalRequest,
  ArtifactView,
  ChangeSet,
  PlanItem,
  RedoResult,
  RunStatus,
  RunSummary,
  UndoResult,
  Usage,
} from './types'

export type BridgeEvent =
  | { seq: number; at: number; type: 'snapshot'; data: { runs: RunSummary[]; activeRunId: string | null } }
  | {
      seq: number
      at: number
      type: 'task/started'
      runId: string
      data: { taskId: string; title: string; chain: string; model: string; startedAt: string }
    }
  | { seq: number; at: number; type: 'task/status'; runId: string; data: { status: RunStatus } }
  | {
      seq: number
      at: number
      type: 'task/ended'
      runId: string
      data: { status: RunStatus; endedAt: string; failure: { category: string | null; message: string | null } }
    }
  | { seq: number; at: number; type: 'message/user'; runId: string; data: { text: string } }
  | {
      seq: number
      at: number
      type: 'message/assistant/delta'
      runId: string
      data: { entryId: string; text: string }
    }
  | {
      seq: number
      at: number
      type: 'message/assistant/done'
      runId: string
      data: { entryId: string; text: string; reasoning?: string }
    }
  | {
      seq: number
      at: number
      type: 'tool/started'
      runId: string
      data: { callId: string; name: string; args: string }
    }
  | {
      seq: number
      at: number
      type: 'tool/finished'
      runId: string
      data: { callId: string; name: string; ok: boolean; summary: string; content?: string; durationMs: number }
    }
  | { seq: number; at: number; type: 'plan/updated'; runId: string; data: { items: PlanItem[] } }
  | { seq: number; at: number; type: 'approval/requested'; runId: string; data: ApprovalRequest }
  | {
      seq: number
      at: number
      type: 'approval/resolved'
      runId: string
      data: { requestId: string; name: string; decision: 'allow' | 'deny' }
    }
  | { seq: number; at: number; type: 'artifact/added' | 'artifact/updated'; runId: string; data: ArtifactView }
  | { seq: number; at: number; type: 'changes/updated'; runId: string; data: ChangeSet }
  | {
      seq: number
      at: number
      type: 'checkpoint/recorded'
      runId: string
      data: { turn: number; at: string; eventCount: number }
    }
  | { seq: number; at: number; type: 'usage/updated'; runId: string; data: Usage }
  | { seq: number; at: number; type: 'undo/started'; runId: string; data: { steps: number } }
  | { seq: number; at: number; type: 'undo/finished'; runId: string; data: UndoResult & { steps: number } }
  | { seq: number; at: number; type: 'redo/finished'; runId: string; data: RedoResult & { steps: number } }

export const EVENT_TYPES = [
  'task/started',
  'task/status',
  'task/ended',
  'message/user',
  'message/assistant/delta',
  'message/assistant/done',
  'tool/started',
  'tool/finished',
  'plan/updated',
  'approval/requested',
  'approval/resolved',
  'artifact/added',
  'artifact/updated',
  'changes/updated',
  'checkpoint/recorded',
  'usage/updated',
  'undo/started',
  'undo/finished',
  'redo/finished',
] as const

export type BridgeEventType = (typeof EVENT_TYPES)[number]
