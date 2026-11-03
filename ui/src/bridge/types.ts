export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'aborted'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface Usage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface RunSummary {
  id: string
  taskId: string
  title: string
  chain: string
  status: RunStatus
  model: string
  startedAt: string
  endedAt?: string
  usage: Usage
  synthetic?: boolean
}

export interface ArtifactCheck {
  exists: boolean
  nonEmpty: boolean
  passed: boolean
  reason?: string | null
}

export interface ArtifactView {
  path: string
  bytes: number
  sha256: string
  check: ArtifactCheck
  truncated?: boolean
}

export interface ChangeFile {
  from: string
  to: string
  sha256: string
  reason?: string
}

export interface ChangeSummary {
  added: number
  modified: number
  moved: number
  deleted: number
  quarantined?: number
}

export interface ChangeSet {
  summary: ChangeSummary
  files: ChangeFile[]
}

export interface TurnView {
  turn: number
  at: string
  eventCount: number
}

export interface CheckpointView {
  currentTurn: number
  startTurn: number
  keep: number
  turns: TurnView[]
  gaps: number[]
}

export interface PlanItem {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done' | 'failed'
}

export interface ApprovalRequest {
  requestId: string
  callId: string
  name: string
  args: string
  riskLevel: RiskLevel
}

export interface Failure {
  path: string
  error: string
}

export type TimelineEntry =
  | { kind: 'user'; id: string; at: number; text: string }
  | { kind: 'assistant'; id: string; at: number; text: string; reasoning?: string; streaming?: boolean }
  | {
      kind: 'tool'
      id: string
      callId: string
      at: number
      name: string
      args: string
      ok?: boolean
      summary?: string
      content?: string
      durationMs?: number
      count?: number
    }
  | { kind: 'approval'; id: string; at: number; requestId: string; name: string; decision?: 'allow' | 'deny' }
  | { kind: 'undo'; id: string; at: number; steps: number; ok: boolean; failures: Failure[] }
  | { kind: 'redo'; id: string; at: number; steps: number; ok: boolean; code?: BridgeErrorCode }
  | { kind: 'status'; id: string; at: number; status: RunStatus; text?: string }

export interface RunView {
  id: string
  taskId: string
  title: string
  chain: string
  status: RunStatus
  model: string
  startedAt: string
  endedAt?: string
  usage: Usage
  synthetic?: boolean
  timeline: TimelineEntry[]
  plan?: PlanItem[]
  approval?: ApprovalRequest
  artifacts: ArtifactView[]
  changes: ChangeSet | null
  checkpoints: CheckpointView
}

export interface WorkbenchState {
  runs: Record<string, RunView>
  order: string[]
  activeRunId: string | null
  unknownEvents: number
  seenSeqs: Record<string, true>
}

export interface TaskCard {
  id: string
  title: string
  chain: string
  path: string
}

export type BridgeErrorCode = 'NOT_FOUND' | 'PRUNED' | 'STALE_TURN' | 'DENIED' | 'INTERNAL'

export interface BridgeError {
  code: BridgeErrorCode
  message: string
}

export type CommandResult<T> = { ok: true; value: T } | { ok: false; error: BridgeError }

export interface UndoResult {
  ok: boolean
  appliedSteps: number
  failures: Failure[]
  code?: BridgeErrorCode
}

export interface RedoResult {
  ok: boolean
  appliedSteps: number
  code?: BridgeErrorCode
}
