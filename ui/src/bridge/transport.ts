import type { BridgeEvent } from './events'
import type {
  ChangeSet,
  CommandResult,
  RedoResult,
  RunStatus,
  RunSummary,
  ModelConfig,
  RunView,
  TaskCard,
  UndoResult,
} from './types'

export interface BridgeTransport {
  /** `replay` 表示没有真实执行，界面据此禁用发送等写操作。 */
  readonly mode?: 'replay' | 'host'
  connect(): Promise<void>
  disconnect(): void
  subscribe(listener: (event: BridgeEvent) => void): () => void
  listTasks(): Promise<CommandResult<RunSummary[]>>
  listCards(): Promise<CommandResult<TaskCard[]>>
  chooseWorkspace(): Promise<CommandResult<{ path: string | null }>>
  readConfig(): Promise<CommandResult<ModelConfig>>
  saveConfig(payload: {
    baseUrl: string
    model: string
    apiKey?: string
    providerName?: string
    priceInput?: number
    priceOutput?: number
  }): Promise<CommandResult<ModelConfig>>
  clearConfig?(): Promise<CommandResult<{ configured: boolean }>>
  openTask(runId: string): Promise<CommandResult<RunView>>
  startTask(cardId: string, workspaceRoot?: string): Promise<CommandResult<{ runId: string }>>
  cancelTask(runId: string): Promise<CommandResult<{ status: RunStatus }>>
  sendMessage(runId: string, text: string): Promise<CommandResult<void>>
  respondApproval(requestId: string, decision: 'allow' | 'deny'): Promise<CommandResult<void>>
  openDiff(runId: string, filePath?: string): Promise<CommandResult<ChangeSet>>
  undo(runId: string, steps: number): Promise<CommandResult<UndoResult>>
  redo(runId: string, steps: number): Promise<CommandResult<RedoResult>>
  revealArtifact(runId: string, path: string): Promise<CommandResult<{ path: string }>>
  readArtifact(
    runId: string,
    path: string,
  ): Promise<CommandResult<{ content: string; truncated: boolean; encoding?: 'utf8' | 'base64' }>>
}
