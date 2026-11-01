import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

// DEV-057 (and TC-VER-059): the service-role key never reaches the browser, and no secret
// or shared password is written in the repository (which is public). See
// docs/CI Secrets and Keys.md for which secret goes where.

const ROOT = process.cwd()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const PASSWORD_LITERAL = /(password|PASSWORD)\s*[:=]\s*['"`][^'"`$\s]{8,}['"`]/
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g

function walk(dir: string, found: string[] = []) {
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, found)
    else if (/\.(js|mjs|cjs|json|html|txt|map|rsc)$/.test(entry.name)) found.push(full)
  }
  return found
}

// the role claim inside a JWT, or null when it is not one
function roleOf(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function leaks(files: string[]) {
  const bad: string[] = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    if (SERVICE_KEY && text.includes(SERVICE_KEY)) bad.push(`${file}: holds the service-role key`)
    for (const token of text.match(JWT) ?? []) {
      if (roleOf(token) === 'service_role') bad.push(`${file}: holds a JWT with the service_role claim`)
    }
  }
  return bad
}

function tracked() {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) return null
  return result.stdout.split('\0').filter(Boolean)
}

test.describe('DEV-057 — secrets stay out of the browser and the repository', () => {
  test('the service-role key is not in the files the browser downloads', () => {
    const staticDir = path.join(ROOT, '.next', 'static')
    test.skip(!fs.existsSync(staticDir), 'no Next.js build output to scan')
    const files = walk(staticDir)
    expect(files.length).toBeGreaterThan(0)
    expect(leaks(files)).toEqual([])
  })

  test('nor in the server build output', () => {
    const serverDir = path.join(ROOT, '.next', 'server')
    test.skip(!fs.existsSync(serverDir), 'no Next.js build output to scan')
    expect(leaks(walk(serverDir))).toEqual([])
  })

  test('the application code reads the service-role key nowhere, and no NEXT_PUBLIC name mentions it', () => {
    const files = tracked()
    test.skip(files === null, 'not a git checkout')
    const code = files!.filter((f) => /^(app|components|lib)\/|^middleware\.ts$/.test(f) && /\.(ts|tsx|js|mjs)$/.test(f))
    expect(code.length).toBeGreaterThan(0)
    const reads = code.filter((f) => /SERVICE_ROLE|service_role/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    expect(reads).toEqual([])

    const named = files!
      .filter((f) => /\.(ts|tsx|js|mjs|yml|yaml|json|mjs)$/.test(f) && f !== 'package-lock.json')
      .filter((f) => /NEXT_PUBLIC_[A-Z_]*SERVICE/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
      // this file names the pattern it looks for
      .filter((f) => f !== 'tests/e2e/secrets.spec.ts')
    expect(named).toEqual([])
  })

  test('no tracked file holds a service-role key or a shared test password', () => {
    const files = tracked()
    test.skip(files === null, 'not a git checkout')
    const text = files!.filter((f) => !/\.(png|jpg|jpeg|gif|ico|woff2?|pdf|lock)$/.test(f) && f !== 'package-lock.json')
    const bad: string[] = []
    for (const file of text) {
      const full = path.join(ROOT, file)
      if (!fs.existsSync(full)) continue
      const content = fs.readFileSync(full, 'utf8')
      if (SERVICE_KEY && content.includes(SERVICE_KEY)) bad.push(`${file}: holds the service-role key`)
      for (const token of content.match(JWT) ?? []) {
        if (roleOf(token) === 'service_role') bad.push(`${file}: holds a JWT with the service_role claim`)
      }
      // a password written as a literal where one is typed or created (not read from the
      // environment); a line that says it is "not a secret" is a marker or a throwaway value
      if (/^(tests|scripts)\//.test(file) && file !== 'tests/e2e/secrets.spec.ts') {
        const hit = content.split('\n').find((line) => PASSWORD_LITERAL.test(line) && !line.includes('not a secret'))
        if (hit) bad.push(`${file}: a password literal: ${hit.trim().slice(0, 40)}…`)
      }
    }
    expect(bad).toEqual([])
  })

  test('environment files are ignored by git', () => {
    for (const name of ['.env', '.env.local', '.env.production', '.env.development.local']) {
      const result = spawnSync('git', ['check-ignore', '-q', name], { cwd: ROOT })
      expect(result.status, `${name} should be ignored`).toBe(0)
    }
    const example = spawnSync('git', ['check-ignore', '-q', '.env.example'], { cwd: ROOT })
    expect(example.status, '.env.example is the committed template').toBe(1)
  })
})
