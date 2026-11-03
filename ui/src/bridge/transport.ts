import type { BridgeEvent } from './events'
import type {
  ChangeSet,
  CommandResult,
  RedoResult,
  RunStatus,
  RunSummary,
  RunView,
  TaskCard,
  UndoResult,
} from './types'

export interface BridgeTransport {
  connect(): Promise<void>
  disconnect(): void
  subscribe(listener: (event: BridgeEvent) => void): () => void
  listTasks(): Promise<CommandResult<RunSummary[]>>
  listCards(): Promise<CommandResult<TaskCard[]>>
  chooseWorkspace(): Promise<CommandResult<{ path: string | null }>>
  openTask(runId: string): Promise<CommandResult<RunView>>
  startTask(cardId: string, workspaceRoot?: string): Promise<CommandResult<{ runId: string }>>
  cancelTask(runId: string): Promise<CommandResult<{ status: RunStatus }>>
  sendMessage(runId: string, text: string): Promise<CommandResult<void>>
  respondApproval(requestId: string, decision: 'allow' | 'deny'): Promise<CommandResult<void>>
  openDiff(runId: string, filePath?: string): Promise<CommandResult<ChangeSet>>
  undo(runId: string, steps: number): Promise<CommandResult<UndoResult>>
  redo(runId: string, steps: number): Promise<CommandResult<RedoResult>>
  readArtifact(runId: string, path: string): Promise<CommandResult<{ content: string; truncated: boolean }>>
}
