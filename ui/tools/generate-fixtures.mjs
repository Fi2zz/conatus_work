#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildFixture, scanRunDirs, writeFixtureFile } from './lib/fixture-build.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(here, '..')
const runsRoot = resolve(projectDir, '..', 'var', 'runs')
const outputDir = join(projectDir, 'src', 'fixtures', 'runs')

const TARGETS = [
  { name: 'organize-v01', taskIds: ['folder-organize-v01'], chain: 'organize' },
  { name: 'csv-sales-analysis-v01', taskIds: ['csv-sales-analysis-v01'], chain: 'csv' },
  { name: 'research-cited-report-v01', taskIds: ['research-cited-report-v01'], chain: 'research' },
]

function readRun(dir) {
  try {
    const run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'))
    return { ...run, dir }
  } catch {
    return null
  }
}

function pickRun(runs, target) {
  const succeeded = runs.filter((run) => run.status === 'succeeded')
  const pool = succeeded.length > 0 ? succeeded : runs
  const exact = pool.filter((run) => target.taskIds.includes(run.taskId))
  const candidates = exact.length > 0 ? exact : pool.filter((run) => run.chain === target.chain)
  // 优先选「产物仍留在工作区」的运行：正文可预览，界面才不是空壳。
  return candidates
    .map((run) => ({ run, present: countPresentArtifacts(run) }))
    .sort((left, right) => right.present - left.present || (left.run.startedAt < right.run.startedAt ? 1 : -1))[0]?.run ?? null
}

function countPresentArtifacts(run) {
  return (run.artifacts ?? []).filter((artifact) => {
    try {
      return existsSync(join(run.workspaceRoot ?? '', artifact.path))
    } catch {
      return false
    }
  }).length
}

const runs = scanRunDirs(runsRoot).map(readRun).filter(Boolean)
const explicit = process.argv.slice(2)

if (explicit.length > 0) {
  for (const dir of explicit) {
    const fixture = buildFixture(resolve(dir))
    const target = join(outputDir, `${basename(resolve(dir))}.json`)
    writeFixtureFile(fixture, target)
    process.stdout.write(`wrote ${basename(target)} (${fixture.events.length} events)\n`)
  }
} else {
  for (const target of TARGETS) {
    const run = pickRun(runs, target)
    if (!run) {
      process.stdout.write(`skip ${target.name}: 没有可用运行记录\n`)
      continue
    }
    const fixture = buildFixture(run.dir)
    const path = join(outputDir, `${target.name}.json`)
    writeFixtureFile(fixture, path)
    process.stdout.write(`wrote ${target.name}.json from ${run.runId} (${fixture.events.length} events)\n`)
  }
}
