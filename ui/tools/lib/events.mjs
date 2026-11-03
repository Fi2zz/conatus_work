import { toTimestamp } from './json-io.mjs'

import { clipContent } from './artifacts.mjs'

function firstLine(text) {
  const line = String(text).split('\n').find((candidate) => candidate.trim().length > 0) ?? ''
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}

export function buildEventStream(rawEvents, startedAt) {
  const base = toTimestamp(startedAt) ?? 0
  const out = []
  const startedCallAt = new Map()
  let seq = 0

  for (const event of rawEvents) {
    const at = Math.max(0, (toTimestamp(event.time) ?? base) - base)

    if (event.type === 'user/message') {
      out.push({ seq: seq++, at, type: 'message/user', data: { text: event.data?.text ?? '' } })
      continue
    }

    if (event.type === 'assistant/message') {
      out.push({
        seq: seq++,
        at,
        type: 'message/assistant/done',
        data: {
          entryId: event.id ?? `assistant-${seq}`,
          text: event.data?.text ?? '',
          ...(event.data?.reasoning ? { reasoning: event.data.reasoning } : {}),
        },
      })
      for (const call of event.data?.toolCalls ?? []) {
        startedCallAt.set(call.id, at)
        out.push({
          seq: seq++,
          at,
          type: 'tool/started',
          data: { callId: call.id, name: call.name, args: call.arguments ?? '{}' },
        })
      }
      continue
    }

    if (event.type === 'tool/result') {
      const startedAtMs = startedCallAt.get(event.data?.callId) ?? at
      out.push({
        seq: seq++,
        at,
        type: 'tool/finished',
        data: {
          callId: event.data?.callId ?? `call-${seq}`,
          name: event.data?.name ?? 'unknown',
          ok: event.data?.isError !== true,
          summary: firstLine(event.data?.content ?? ''),
          content: clipContent(event.data?.content ?? ''),
          durationMs: Math.max(0, at - startedAtMs),
        },
      })
    }
  }

  return out
    .map((event, index) => ({ event, index }))
    .sort((left, right) => left.event.at - right.event.at || left.index - right.index)
    .map(({ event }, index) => ({ ...event, seq: index }))
}
