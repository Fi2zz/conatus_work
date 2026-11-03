import { EVENT_TYPES } from '@/bridge/events'

it('covers every event type in the spec', () => {
  const expected = [
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
  ]
  expect([...EVENT_TYPES]).toEqual(expected)
})
