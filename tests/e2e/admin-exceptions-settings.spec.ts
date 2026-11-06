import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { Client } from 'pg'
import { nairobiDay, today } from './factories'
import { localDbUrl } from './visit-helpers'
import { codeOf } from './source-strings'
import { checkInAt, exceptionsFor, exceptionsLocal, flagsOf, hours, makeExceptionAdmin, makeExceptionBooking, minutes, plus, type ExceptionAdmin } from './exceptions-data'

// DEV-079, AC-020 (FD-ADMINEXC S7): the 30-minute figure, DEC-3 and DEC-4 are each held in ONE setting
// (private.exception_settings). Changing one value moves its boundary with no code change and no migration,
// and none of the three figures is written as a literal in the view or in the code that decides a row. The
// two copy lines that say "7 days" are text in the shared strings module and are not under this criterion
// (decision 15).
//
// It changes a shared table for a moment, which every Exceptions read depends on, so it runs on its own, after
// every other test (playwright.config.ts, the `visit-snapshot` project), and puts the three rows back after
// each test. Local stack only (the settings are changed over a direct database connection).

test.describe.configure({ mode: 'serial' })
test.skip(!exceptionsLocal, 'the settings are changed over a direct database connection, which only the local stack allows')

const ORIGINAL = { on_time_minutes: 30, in_progress_hours: 8, window_days: 7 }

async function withDb<T>(use: (db: Client) => Promise<T>) {
  const db = new Client({ connectionString: localDbUrl() })
  await db.connect()
  try {
    return await use(db)
  } finally {
    await db.end()
  }
}
const setSetting = (key: keyof typeof ORIGINAL, value: number) =>
  withDb((db) => db.query('update private.exception_settings set value = $2 where key = $1', [key, value]))
const readSettings = () =>
  withDb(async (db) => Object.fromEntries((await db.query('select key, value from private.exception_settings order by key')).rows.map((row) => [row.key, row.value])))

let admin: ExceptionAdmin | null = null
test.afterEach(async () => {
  for (const [key, value] of Object.entries(ORIGINAL)) await setSetting(key as keyof typeof ORIGINAL, value)
  await admin?.clearNow()
  admin = null
  expect(await readSettings(), 'the three rows are back as they were').toEqual(ORIGINAL)
})

const R = () => nairobiDay(today, '09:00')

test.describe('DEV-079 — the three settings (AC-020)', () => {
  test('the three rows are there with the founder\'s figures: 30 minutes, DEC-3 = 8 hours, DEC-4 = 7 days', async () => {
    expect(await readSettings()).toEqual(ORIGINAL)
  })

  test('none of the three figures is a literal in the view or in the code that decides a row', async () => {
    const definition = await withDb(async (db) => (await db.query(`select pg_get_viewdef('public.admin_exceptions'::regclass) as definition`)).rows[0].definition as string)
    expect(definition).toContain('exception_settings')
    expect(definition, 'the view').not.toMatch(/\b(30|8|7)\b/)
    for (const file of ['lib/admin/exceptions.ts', 'app/admin/exceptions/actions.ts', 'components/admin/exceptions-screen.tsx']) {
      const code = codeOf(readFileSync(path.join(__dirname, '..', '..', file), 'utf8'))
      expect(code, file).not.toMatch(/\b(30|8|7)\b/)
    }
  })

  test('the 30-minute figure moves its boundary: E1 and E2 follow the setting, with no change to any code', async () => {
    admin = await makeExceptionAdmin()
    const b = await makeExceptionBooking({ requested: R() })
    const late = await makeExceptionBooking({ requested: R() })
    await checkInAt(late, plus(R(), minutes(40)))
    await admin.setNow(plus(R(), hours(1)))
    expect((await exceptionsFor(admin, b.id, late.id)).map((row) => [row.booking_id, ...flagsOf(row)]).sort()).toEqual([[b.id, 'e1'], [late.id, 'e2']].sort())

    await setSetting('on_time_minutes', 45)
    expect(await exceptionsFor(admin, late.id), 'checked in 40 minutes after is on time when the figure is 45').toEqual([])
    await admin.setNow(plus(R(), minutes(45)))
    expect(await exceptionsFor(admin, b.id), 'exactly 45 minutes').toEqual([])
    await admin.setNow(plus(R(), minutes(45) + 1000))
    const rows = await exceptionsFor(admin, b.id)
    expect(rows.map(flagsOf)).toEqual([['e1']])
    expect(rows[0].minutes_since_requested).toBe(45)
  })

  test('DEC-3 moves its boundary: an open visit shows after 4 hours when the setting is 4, and not after 5 when it is 8', async () => {
    admin = await makeExceptionAdmin()
    const b = await makeExceptionBooking({ requested: R() })
    const checkedIn = plus(R(), minutes(5))
    await checkInAt(b, checkedIn)
    await admin.setNow(plus(checkedIn, hours(5)))
    expect(await exceptionsFor(admin, b.id), 'five hours with the setting at eight').toEqual([])

    await setSetting('in_progress_hours', 4)
    expect((await exceptionsFor(admin, b.id)).map(flagsOf)).toEqual([['e3']])
    await admin.setNow(plus(checkedIn, hours(4)))
    expect(await exceptionsFor(admin, b.id), 'exactly four hours').toEqual([])
  })

  test('DEC-4 moves its boundary: a booking five days back is in the window at 7 days and out of it at 3', async () => {
    admin = await makeExceptionAdmin()
    const b = await makeExceptionBooking({ requested: nairobiDay(-5, '09:00') })
    expect((await exceptionsFor(admin, b.id)).map(flagsOf)).toEqual([['e1']])
    await setSetting('window_days', 3)
    expect(await exceptionsFor(admin, b.id)).toEqual([])
    await setSetting('window_days', 5)
    expect((await exceptionsFor(admin, b.id)).map(flagsOf), 'the fifth day back is the first day inside a window of five').toEqual([['e1']])
  })

  test('a setting must be a positive whole number, and only the three keys exist', async () => {
    await expect(setSetting('on_time_minutes', 0)).rejects.toThrow()
    await expect(withDb((db) => db.query(`insert into private.exception_settings (key, value) values ('extra', 1)`))).rejects.toThrow()
  })
})
