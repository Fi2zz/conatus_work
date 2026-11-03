import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function readJson(path) {
  if (!path || !existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function readEvents(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export function readWorkspaceFile(root, relativePath) {
  if (!root || !relativePath) return null
  const path = join(root, relativePath)
  if (!existsSync(path)) return null
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

export function toTimestamp(time) {
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? null : parsed
}

export function parseJson(text) {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
