import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { countLine, COUNT_SEPARATOR, type CountedOutcome } from '../../lib/visits/count-line'
import { logInViaUI } from './helpers'
import { seedFamilyVisibility, type FamilyVisibilityData } from './family-visibility-data'
import { codeOf, stringsOf } from './source-strings'
import type { TestUser } from './factories'

// DEV-077: the count line of the family's visit report (FR-007, P1; FD-FAMVIS §5.7(c), §6.5): the pure
// function countLine and its place in the report. The unit tests are the ones the ticket names (all done,
// mixed, only not recorded, no tasks); the rest read it on the screen with the DEV-074 data.

const tasks = (...outcomes: CountedOutcome[]) => outcomes.map((outcome) => ({ outcome }))

test.describe('DEV-077 — countLine', () => {
  test('all done', () => {
    expect(countLine(tasks('done', 'done', 'done'))).toBe('3 done')
  })

  test('mixed: "[n] done", "[n] not done", "[n] not recorded", in that order, joined by " · "', () => {
    expect(countLine(tasks('done', 'done', 'not_done', 'not_recorded'))).toBe('2 done · 1 not done · 1 not recorded')
    // the order is the same whatever order the tasks come in
    expect(countLine(tasks('not_recorded', 'not_done', 'done', 'done'))).toBe('2 done · 1 not done · 1 not recorded')
    expect(COUNT_SEPARATOR).toBe(' · ')
  })

  test('zero parts are left out', () => {
    expect(countLine(tasks('done', 'not_recorded'))).toBe('1 done · 1 not recorded')
    expect(countLine(tasks('not_done', 'done'))).toBe('1 done · 1 not done')
    expect(countLine(tasks('not_done', 'not_done'))).toBe('2 not done')
    expect(countLine(tasks('done', 'done', 'not_done', 'not_done'))).toBe('2 done · 2 not done')
  })

  test('only not recorded', () => {
    expect(countLine(tasks('not_recorded'))).toBe('1 not recorded')
    expect(countLine(tasks('not_recorded', 'not_recorded'))).toBe('2 not recorded')
  })

  test('no tasks: no line', () => {
    expect(countLine([])).toBeNull()
  })

  test('plain text: no percentage, no judgement word, no colour, whatever the counts', () => {
    const lines = [tasks('done', 'done', 'done'), tasks('done', 'not_done', 'not_recorded'), tasks('not_recorded'), tasks('not_done', 'not_done'), tasks(...Array(12).fill('done') as CountedOutcome[])]
    for (const set of lines) {
      const line = countLine(set)!
      expect(line, line).toMatch(/^\d+ (done|not done|not recorded)( · \d+ (done|not done|not recorded))*$/)
      expect(line).not.toMatch(/%|percent|\ball\b|\bonly\b|complete|missed|failed|good|well|great|problem|incomplete|\bjust\b/i)
    }
  })

  test('the strings of the function are only those words (quality gate)', () => {
    const strings = stringsOf(readFileSync('lib/visits/count-line.ts', 'utf8'))
    expect(strings).not.toMatch(/%|percent|\ball\b|\bonly\b|complete|missed|failed|good|great|problem|incomplete/i)
    expect(codeOf(readFileSync('lib/visits/count-line.ts', 'utf8'))).not.toMatch(/toFixed|Math\.round|\* 100|\/ tasks\.length/)
  })
})

test.describe('DEV-077 — the count line in the report', () => {
  test.describe.configure({ mode: 'serial' })
  let data: FamilyVisibilityData

  test.beforeAll(async () => {
    data = await seedFamilyVisibility()
  })

  async function open(page: Page, family: TestUser, bookingId: string) {
    await logInViaUI(page, family.email, family.password, '**/recipients')
    await page.goto(`/bookings/${bookingId}`)
    await expect(page.getByTestId('visit-report')).toBeVisible()
  }
  const line = (page: Page) => page.getByTestId('report-count-line')

  test('MediCheck: one done, one not done, one not recorded', async ({ page }) => {
    await open(page, data.medicheck.family, data.medicheck.booking.id)
    await expect(line(page)).toHaveText('1 done · 1 not done · 1 not recorded')
  })

  test("Doctor's Day Out: two done, one not done, one not recorded", async ({ page }) => {
    await open(page, data.clinic.family, data.clinic.booking.id)
    await expect(line(page)).toHaveText('2 done · 1 not done · 1 not recorded')
  })

  test('a report with nothing Not done leaves that part out', async ({ page }) => {
    // the caregiver who lost Verified: Vitals Done, Medication Done (logged by the factory), Companionship never logged
    await open(page, data.lostVerified.family, data.lostVerified.booking.id)
    await expect(line(page)).toHaveText('2 done · 1 not recorded')
  })

  test('its place: directly under the recorded-by line, above the first task, and it moves nothing else', async ({ page }) => {
    await open(page, data.medicheck.family, data.medicheck.booking.id)
    const recordedBy = (await page.getByTestId('visit-report').getByText('This is what your caregiver recorded').boundingBox())!
    const count = (await line(page).boundingBox())!
    const first = (await page.getByTestId('report-task').first().boundingBox())!
    expect(count.y).toBeGreaterThanOrEqual(recordedBy.y + recordedBy.height - 1)
    expect(count.y + count.height).toBeLessThanOrEqual(first.y + 1)
    // it is one paragraph of plain text, not a chip or a link
    await expect(line(page).locator('*')).toHaveCount(0)
  })

  test('plain text in the same dark and 16px as the rest of the report: no colour of its own', async ({ page }) => {
    await open(page, data.medicheck.family, data.medicheck.booking.id)
    const styles = await page.evaluate(() => {
      const count = document.querySelector('[data-testid="report-count-line"]') as HTMLElement
      const recorded = [...document.querySelectorAll('[data-testid="visit-report"] p')].find((p) => (p.textContent ?? '').startsWith('This is what your caregiver')) as HTMLElement
      const s = (e: HTMLElement) => ({ color: getComputedStyle(e).color, size: getComputedStyle(e).fontSize, weight: getComputedStyle(e).fontWeight, background: getComputedStyle(e).backgroundColor })
      return { count: s(count), recorded: s(recorded) }
    })
    expect(styles.count).toEqual(styles.recorded)
    expect(styles.count.size).toBe('16px')
    expect(styles.count.background).toBe('rgba(0, 0, 0, 0)')
  })

  test('the line agrees with the task blocks below it', async ({ page }) => {
    for (const { family, booking } of [data.medicheck, data.clinic, data.long, data.lostVerified]) {
      await open(page, family, booking.id)
      const chips = await page.getByTestId('report-task').locator('span.rounded-full').allInnerTexts()
      const count = (word: string) => chips.filter((c) => c === word).length
      const expected = countLine(
        chips.map((c) => ({ outcome: (c === 'Done' ? 'done' : c === 'Not done' ? 'not_done' : 'not_recorded') as CountedOutcome })),
      )
      expect(await line(page).innerText(), `${count('Done')} done`).toBe(expected)
    }
  })

  test('a completed booking with no visit has no report and so no line', async ({ page }) => {
    await logInViaUI(page, data.noVisit.family.email, data.noVisit.family.password, '**/recipients')
    await page.goto(`/bookings/${data.noVisit.booking.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(line(page)).toHaveCount(0)
  })
})
