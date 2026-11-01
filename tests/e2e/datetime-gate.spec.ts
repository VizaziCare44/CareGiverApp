import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

// DEV-068: lib/datetime.ts is the only place that formats a date or a time for display, or
// does date arithmetic on one. This is the quality-gate search the task asks for: any
// other file that does it fails the build.

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\.toLocale(Date|Time)?String\s*\(/, 'toLocaleString / toLocaleDateString / toLocaleTimeString'],
  [/Intl\s*\.\s*DateTimeFormat/, 'Intl.DateTimeFormat'],
  [/\.(toDateString|toTimeString|toUTCString|toGMTString)\s*\(/, 'toDateString / toTimeString / toUTCString'],
  [/\.get(UTC)?(Hours|Minutes|Seconds|Date|Day|Month|FullYear|TimezoneOffset)\s*\(/, 'reading a part of a Date'],
  [/\.set(UTC)?(Hours|Minutes|Seconds|Date|Month|FullYear)\s*\(/, 'changing a part of a Date'],
  [/toISOString\(\)\s*\.\s*(slice|split|substring|substr)\s*\(/, 'cutting a date out of toISOString()'],
]

test.describe('DEV-068 — one place formats dates and times', () => {
  test('no application code formats or calculates a date outside lib/datetime.ts', () => {
    const listed = spawnSync('git', ['ls-files', '-z'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    test.skip(listed.status !== 0, 'not a git checkout')
    const code = listed.stdout
      .split('\0')
      .filter((f) => /^(app|components|lib)\/.*\.(ts|tsx)$/.test(f) && f !== 'lib/datetime.ts')
    expect(code.length).toBeGreaterThan(10)

    const hits: string[] = []
    for (const file of code) {
      const lines = fs.readFileSync(path.join(process.cwd(), file), 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
        for (const [pattern, what] of FORBIDDEN) {
          if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${what}: ${line.trim().slice(0, 70)}`)
        }
      })
    }
    expect(hits, 'format dates and times through lib/datetime.ts').toEqual([])
  })
})
