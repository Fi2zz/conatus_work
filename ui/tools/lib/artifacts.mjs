import { readWorkspaceFile } from './json-io.mjs'

const MAX_INLINE_BYTES = 64 * 1024

export function clipContent(text) {
  const value = String(text ?? '')
  return value.length > 2000 ? `${value.slice(0, 2000)}…` : value
}

export function buildArtifacts(workspaceRoot, artifacts) {
  const files = {}
  const views = []
  for (const artifact of artifacts ?? []) {
    const view = {
      path: artifact.path,
      bytes: artifact.bytes ?? 0,
      sha256: artifact.sha256 ?? '',
      check: artifact.check ?? { exists: true, nonEmpty: true, passed: true, reason: null },
    }
    const content = readWorkspaceFile(workspaceRoot, artifact.path)
    if (content !== null) {
      const truncated = Buffer.byteLength(content, 'utf8') > MAX_INLINE_BYTES
      files[artifact.path] = truncated ? Buffer.from(content, 'utf8').subarray(0, MAX_INLINE_BYTES).toString('utf8') : content
      if (truncated) view.truncated = true
    }
    views.push(view)
  }
  return { files, views }
}
