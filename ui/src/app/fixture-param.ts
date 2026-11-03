import { DEFAULT_FIXTURE_ID } from '@/fixtures'

export interface FixtureParam {
  fixtureId: string
  speed: number
}

export function readFixtureParam(search: string): FixtureParam {
  const params = new URLSearchParams(search)
  const fixtureId = params.get('fixture') ?? DEFAULT_FIXTURE_ID
  const rawSpeed = params.get('speed')
  const speed = rawSpeed === null || rawSpeed.trim() === '' ? 1 : Number(rawSpeed)
  return { fixtureId, speed: Number.isFinite(speed) && speed >= 0 ? speed : 1 }
}
