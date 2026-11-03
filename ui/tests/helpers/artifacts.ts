import type { BridgeTransport } from '@/bridge/transport'
import type { ArtifactView, CommandResult } from '@/bridge/types'
import { setTransport } from '@/bridge/transport-store'
import { useUiStore } from '@/state/ui-state'

import { seedRun } from '../helpers/state'

export const artifact = (path: string, over: Partial<ArtifactView> = {}): ArtifactView => ({
  path,
  bytes: 128,
  sha256: 'a'.repeat(64),
  check: { exists: true, nonEmpty: true, passed: true },
  ...over,
})

export function seedArtifacts(
  artifacts: ArtifactView[],
  files: Record<string, string>,
  binary: Record<string, string> = {},
): void {
  seedRun([], { artifacts })
  useUiStore.setState({ rightTab: 'artifacts', selectedArtifact: artifacts[0]?.path ?? null })
  const transport = {
    async readArtifact(
      _runId: string,
      path: string,
    ): Promise<CommandResult<{ content: string; truncated: boolean; encoding?: 'utf8' | 'base64' }>> {
      const binaryContent = binary[path]
      if (binaryContent !== undefined) {
        return { ok: true, value: { content: binaryContent, truncated: false, encoding: 'base64' } }
      }
      const content = files[path]
      if (content === undefined) return { ok: false, error: { code: 'NOT_FOUND', message: path } }
      const truncated = artifacts.find((item) => item.path === path)?.truncated === true
      return { ok: true, value: { content, truncated } }
    },
  } as unknown as BridgeTransport
  setTransport(transport)
}
