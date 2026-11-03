import { FixtureError, parseFixture } from '@/bridge/fixture'
import { FIXTURES } from '@/fixtures'

it('parses every committed fixture', async () => {
  for (const entry of FIXTURES) {
    const fixture = await entry.load()
    expect(fixture.run.id).toBeTruthy()
    expect(Array.isArray(fixture.events)).toBe(true)
  }
})

it('rejects a fixture missing checkpoints', () => {
  expect(() => parseFixture({ schemaVersion: 1 })).toThrow(FixtureError)
})

it('rejects an unknown schema version', () => {
  expect(() => parseFixture({ schemaVersion: 2 })).toThrow(/schemaVersion/)
})

it('marks edge fixtures synthetic', async () => {
  const edge = FIXTURES.filter((entry) => entry.id.startsWith('edge-'))
  expect(edge).toHaveLength(4)
  for (const entry of edge) {
    const fixture = await entry.load()
    expect(entry.synthetic).toBe(true)
    expect(fixture.run.synthetic).toBe(true)
  }
})

it('edge-undo-failed has per-file failures', async () => {
  const fixture = await FIXTURES.find((entry) => entry.id === 'edge-undo-failed')!.load()
  expect(fixture.scripts?.undo?.failures.length).toBeGreaterThanOrEqual(1)
})

it('edge-redo-pruned returns PRUNED', async () => {
  const fixture = await FIXTURES.find((entry) => entry.id === 'edge-redo-pruned')!.load()
  expect(fixture.scripts?.redo?.code).toBe('PRUNED')
})

it('edge-checkpoint-gap records a gap', async () => {
  const fixture = await FIXTURES.find((entry) => entry.id === 'edge-checkpoint-gap')!.load()
  expect(fixture.checkpoints.gaps).toEqual([2])
})

it('rejects an artifact without a check block', async () => {
  const { FIXTURES: list } = await import('@/fixtures')
  const base = (await list[0].load()) as unknown as Record<string, unknown>
  const broken = { ...base, artifacts: [{ path: 'out/a.md', bytes: 1, sha256: 'x' }] }
  expect(() => parseFixture(broken)).toThrow(/artifacts\[0\]\.check/)
})

it('rejects a change file without from/to', async () => {
  const base = (await FIXTURES[0].load()) as unknown as Record<string, unknown>
  const broken = {
    ...base,
    changes: { summary: { added: 0, modified: 0, moved: 1, deleted: 0 }, files: [{ from: 'a' }] },
  }
  expect(() => parseFixture(broken)).toThrow(/changes\.files\[0\]/)
})
