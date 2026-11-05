import { test, expect, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { formatDateTime } from '../../lib/datetime'
import { FAMILY_REPORT, FAMILY_VISIT } from '../../lib/visits/family-visit-text'
import { reportTitle } from '../../lib/visits/family-visit'
import { logInViaUI } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, makeVisit, nairobiDay, today, type TestUser } from './factories'
import { seedFamilyVisibility, MULTI_LINE_READINGS, MULTI_LINE_VISIT_NOTE, type FamilyVisibilityData } from './family-visibility-data'
import { getVisit } from './visit-helpers'
import { codeOf, stringsOf } from './source-strings'

// DEV-076: the family's visit report on Booking Detail (state F3; frames FAM-03 to FAM-06; FR-003 to
// FR-006, FR-008, FR-010; AC-002 to AC-006, AC-010, AC-014). Every case is built with the DEV-074 data
// (real functions, the caregiver's own session) and read here the way the family sees it. The wording
// and the layout are drafted from the ticket: the frames and §6.4/§6.5 were not available.

test.describe.configure({ mode: 'serial' })

let data: FamilyVisibilityData
let words: { family: TestUser; booking: { id: string }; caregiverPhone: string }

const UNBROKEN = `https://example.com/${'a'.repeat(300)}`
const MARKUP = '<b>bold</b> **star** [a link](https://example.com)'

test.beforeAll(async () => {
  data = await seedFamilyVisibility()

  // a case of the caregiver's words that look like markup, and strings with no spaces
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const booking = await makeBooking({ family, recipient: await makeRecipient({ family }), status: 'assigned', caregiver, visit: nairobiDay(today) })
  await makeVisit({
    booking,
    caregiver,
    tasks: [{ key: 'Vitals check', outcome: 'done', note: `${MARKUP}\n${UNBROKEN}` }],
    closed: true,
    visitNote: `${'b'.repeat(300)}\n${UNBROKEN}`,
  })
  words = { family, booking, caregiverPhone: '+254700000030' }
})

const report = (page: Page) => page.getByTestId('visit-report')
const taskBlock = (page: Page, name: string) => page.getByTestId('report-task').filter({ hasText: name })

async function open(page: Page, family: TestUser, bookingId: string) {
  await logInViaUI(page, family.email, family.password, '**/recipients')
  await page.goto(`/bookings/${bookingId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const style = (locator: Locator) =>
  locator.evaluate((element) => {
    const s = getComputedStyle(element)
    return {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      color: s.color,
      backgroundColor: s.backgroundColor,
      borderColor: s.borderTopColor,
      borderWidth: s.borderTopWidth,
      paddingTop: s.paddingTop,
      paddingLeft: s.paddingLeft,
      height: `${element.getBoundingClientRect().height}`,
      whiteSpace: s.whiteSpace,
    }
  })

test.describe('DEV-076 — the MediCheck report, in the order of §6.1', () => {
  test('title, both times, the recorded-by line, the tasks in order, then the note about the visit', async ({ page }) => {
    const { family, booking } = data.medicheck
    const visit = (await getVisit(booking.id))!
    await open(page, family, booking.id)

    await expect(report(page).getByRole('heading', { name: 'MediCheck Report' })).toBeVisible()
    expect(reportTitle('medicheck')).toBe('MediCheck Report')
    await expect(page.getByTestId('report-checked-in')).toHaveText(formatDateTime(visit.checked_in_at))
    await expect(page.getByTestId('report-checked-out')).toHaveText(formatDateTime(visit.checked_out_at!))
    await expect(report(page).getByText('Checked in at', { exact: true })).toBeVisible()
    await expect(report(page).getByText('Checked out at', { exact: true })).toBeVisible()
    await expect(report(page)).toContainText('This is what your caregiver recorded during the visit. Vizazi Care does not check or interpret it.')

    const names = await page.getByTestId('report-task').locator('span').filter({ hasText: /^(Medication assistance|Vitals check|Companionship)$/ }).allInnerTexts()
    expect(names).toEqual(['Medication assistance', 'Vitals check', 'Companionship'])

    // the order down the page
    const y = async (locator: Locator) => (await locator.boundingBox())!.y
    const order = [
      await y(report(page).getByRole('heading', { name: 'MediCheck Report' })),
      await y(page.getByTestId('report-checked-in')),
      await y(page.getByTestId('report-checked-out')),
      await y(report(page).getByText('This is what your caregiver recorded')),
      await y(taskBlock(page, 'Medication assistance')),
      await y(taskBlock(page, 'Vitals check')),
      await y(taskBlock(page, 'Companionship')),
      await y(page.getByTestId('visit-note-card')),
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))

    // the time is on its own line under its label
    const label = (await report(page).getByText('Checked in at', { exact: true }).boundingBox())!
    const time = (await page.getByTestId('report-checked-in').boundingBox())!
    expect(time.y).toBeGreaterThanOrEqual(label.y + label.height - 1)
  })

  test('each task: the outcome, "Logged at … EAT", the reason or the note; an Optional task never logged has no time', async ({ page }) => {
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)

    const medication = taskBlock(page, 'Medication assistance')
    await expect(medication).toContainText('Not done')
    await expect(medication).toContainText('Reason:')
    await expect(medication).toContainText('She refused the second dose')
    await expect(medication).toContainText(/Logged at \d{2}:\d{2} EAT/)
    // only the entry that counts: the earlier Done is not shown
    await expect(medication).not.toContainText('Gave the morning tablets')
    await expect(medication).not.toContainText('Note:')

    const vitals = taskBlock(page, 'Vitals check')
    await expect(vitals).toContainText('Done')
    await expect(vitals).toContainText('Note:')
    await expect(vitals).toContainText(/Logged at \d{2}:\d{2} EAT/)
    expect(await vitals.getByText('Blood pressure 128/82').innerText()).toBe(MULTI_LINE_READINGS)

    const companionship = taskBlock(page, 'Companionship')
    await expect(companionship).toContainText('Not recorded')
    await expect(companionship).not.toContainText('Logged at')
    await expect(companionship).not.toContainText('Reason:')
    await expect(companionship).not.toContainText('Note:')

  })

  test('the note about the visit is its own card, with line breaks and the blank line kept', async ({ page }) => {
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)
    const card = page.getByTestId('visit-note-card')
    await expect(card.getByRole('heading', { name: 'Note about the visit' })).toBeVisible()
    expect(await card.locator('p').innerText()).toBe(MULTI_LINE_VISIT_NOTE)
    expect(await card.locator('p').evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('pre-wrap')
  })
})

test.describe("DEV-076 — the Doctor's Day Out report", () => {
  test('"Clinic Visit Report", a Not done task with its reason, an Optional task never logged, and no card for a note that was not written', async ({ page }) => {
    const { family, booking } = data.clinic
    await open(page, family, booking.id)
    await expect(report(page).getByRole('heading', { name: 'Clinic Visit Report' })).toBeVisible()
    expect(reportTitle('doctors_day_out')).toBe('Clinic Visit Report')

    const advocacy = taskBlock(page, 'Advocacy and note-taking')
    await expect(advocacy).toContainText('Not done')
    await expect(advocacy).toContainText('The doctor ran late and we left before the discussion')
    const prep = taskBlock(page, 'Pre-visit preparation')
    await expect(prep).toContainText('Not recorded')
    await expect(prep).not.toContainText('Logged at')
    await expect(page.getByTestId('report-task')).toHaveCount(4)
    // no empty card
    await expect(page.getByTestId('visit-note-card')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Note about the visit' })).toHaveCount(0)
  })
})

test.describe('DEV-076 — the outcome chips and the 16px floor', () => {
  test('every text node in the report, chips included, computes at 16px or more, and none is in the muted grey', async ({ page }) => {
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)
    const found = await page.evaluate(() => {
      const roots = [...document.querySelectorAll('[data-testid="visit-report"], [data-testid="visit-note-card"]')]
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--figma-muted').trim()
      const sizes: { text: string; size: number; color: string }[] = []
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = (node.textContent ?? '').trim()
          if (!text || !node.parentElement) continue
          const s = getComputedStyle(node.parentElement)
          sizes.push({ text: text.slice(0, 30), size: parseFloat(s.fontSize), color: s.color })
        }
      }
      const probe = document.createElement('span')
      probe.style.color = muted
      document.body.appendChild(probe)
      const mutedRgb = getComputedStyle(probe).color
      probe.remove()
      return { sizes, mutedRgb }
    })
    expect(found.sizes.length).toBeGreaterThan(10)
    for (const item of found.sizes) {
      expect(item.size, `"${item.text}" is ${item.size}px`).toBeGreaterThanOrEqual(16)
      expect(item.color, `"${item.text}" is in the muted grey`).not.toBe(found.mutedRgb)
    }
  })

  test('the three outcome chips differ only in the icon and the word, and the report size is as drawn', async ({ page }) => {
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)
    const chip = (name: string) => taskBlock(page, name).locator('span.rounded-full')
    const done = chip('Vitals check')
    const notDone = chip('Medication assistance')
    const notRecorded = chip('Companionship')

    await expect(done).toHaveText('Done')
    await expect(notDone).toHaveText('Not done')
    await expect(notRecorded).toHaveText('Not recorded')
    await expect(done.locator('svg')).toHaveAttribute('data-icon', 'check')
    await expect(notDone.locator('svg')).toHaveAttribute('data-icon', 'dash')
    await expect(notRecorded.locator('svg')).toHaveAttribute('data-icon', 'dash')

    const [a, b, c] = [await style(done), await style(notDone), await style(notRecorded)]
    // widths differ with the word; every other computed style is the same
    expect({ ...b, height: '' }).toEqual({ ...a, height: '' })
    expect({ ...c, height: '' }).toEqual({ ...a, height: '' })
    // as drawn: 16px, Medium, 31px high, 10px left and right and 5px top and bottom
    expect(a.fontSize).toBe('16px')
    expect(a.fontWeight).toBe('500')
    expect(parseFloat(a.height)).toBeCloseTo(31, 0)
    // (the 1px outline counts as part of the padding: 9 + 1 = 10 and 4 + 1 = 5)
    expect(parseFloat(a.paddingLeft) + parseFloat(a.borderWidth)).toBe(10)
    expect(parseFloat(a.paddingTop) + parseFloat(a.borderWidth)).toBe(5)
    expect(await done.locator('svg').evaluate((e) => e.getBoundingClientRect().width)).toBe(16)
    // no red, green or amber: not the amber of the waiting chips, and the same neutral as the other grey chips
    expect(a.backgroundColor).not.toBe('rgb(255, 243, 220)')
  })

  test('a Not done task is drawn exactly like a Done task: the same computed style on its name and on its text', async ({ page }) => {
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)
    const nameStyle = (name: string) => style(taskBlock(page, name).locator('span.font-medium').first())
    expect(await nameStyle('Medication assistance')).toEqual(await nameStyle('Vitals check'))
    // (the heights differ with the amount of text, so they are left out)
    const textOf = async (name: string, label: string) => ({ ...(await style(taskBlock(page, name).getByText(label, { exact: true }).locator('xpath=following-sibling::p'))), height: '' })
    expect(await textOf('Medication assistance', 'Reason:')).toEqual(await textOf('Vitals check', 'Note:'))
  })

  test('the status chips and the caregiver chips on their own screens still compute 14px', async ({ page }) => {
    // the family's caregiver block: the Verified pill
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)
    await expect(page.getByRole('region', { name: 'Caregiver' }).getByText('Verified', { exact: true })).toHaveCSS('font-size', '14px')

    // the caregiver's Assignment Detail: the In progress chip
    const { caregiver, booking: open2 } = data.inProgress
    await page.context().clearCookies()
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    await page.goto(`/assignments/${open2.id}`)
    await expect(page.getByText('In progress', { exact: true }).first()).toHaveCSS('font-size', '14px')
  })
})

test.describe('DEV-076 — the caregiver\'s words, in full, as text', () => {
  test('a 2,000-character task note, a 500-character reason and a 2,000-character visit note are shown whole', async ({ page }) => {
    const { family, booking, taskNote, reason, visitNote } = data.long
    await open(page, family, booking.id)
    expect(await taskBlock(page, 'Vitals check').locator('p.whitespace-pre-wrap').innerText()).toBe(taskNote)
    expect(await taskBlock(page, 'Medication assistance').locator('p.whitespace-pre-wrap').innerText()).toBe(reason)
    expect(await page.getByTestId('visit-note-card').locator('p').innerText()).toBe(visitNote)
    // nothing behind "show more"
    await expect(page.getByText(/show more|read more|see more/i)).toHaveCount(0)
  })

  for (const width of [360, 390]) {
    test(`at ${width}px wide the long texts wrap inside their cards and the page does not scroll sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const { family, booking } = data.long
      await open(page, family, booking.id)
      await expect(report(page)).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      const card = (await report(page).boundingBox())!
      for (const text of await report(page).locator('p.whitespace-pre-wrap').all()) {
        const box = (await text.boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5)
      }
      const note = (await page.getByTestId('visit-note-card').boundingBox())!
      const noteText = (await page.getByTestId('visit-note-card').locator('p').boundingBox())!
      expect(noteText.x + noteText.width).toBeLessThanOrEqual(note.x + note.width + 0.5)
    })
  }

  for (const width of [360, 390]) {
    test(`at ${width}px a string with no spaces (a web address) wraps as well`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await open(page, words.family, words.booking.id)
      await expect(report(page)).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      const card = (await report(page).boundingBox())!
      for (const text of await report(page).locator('p.whitespace-pre-wrap').all()) {
        expect((await text.boundingBox())!.x + (await text.boundingBox())!.width).toBeLessThanOrEqual(card.x + card.width + 0.5)
      }
      // and the whole string is there
      expect(await page.getByTestId('visit-note-card').locator('p').innerText()).toContain(UNBROKEN)
    })
  }

  test('markup, markdown and links are text only: nothing is parsed, nothing is a link', async ({ page }) => {
    await open(page, words.family, words.booking.id)
    const note = taskBlock(page, 'Vitals check').locator('p.whitespace-pre-wrap')
    expect(await note.innerText()).toContain(MARKUP)
    await expect(report(page).locator('b, strong, em, a, img, script')).toHaveCount(0)
    await expect(page.getByTestId('visit-note-card').locator('b, strong, em, a, img, script')).toHaveCount(0)
  })
})

test.describe('DEV-076 — what the report never has', () => {
  test('no Required or Optional, no earlier entry, no caregiver id or phone, no price, none of the blamed words', async ({ page }) => {
    const { family, booking } = data.medicheck
    await open(page, family, booking.id)
    const text = await report(page).innerText()
    expect(text).not.toMatch(/\b(required|optional)\b/i)
    expect(text).not.toMatch(/\b(arrived|left|on site|failed|missed|incomplete|problem)\b/i)
    expect(text).not.toContain('Gave the morning tablets')
    expect(text).not.toContain(words.caregiverPhone)
    expect(text).not.toMatch(/\bKES\b|\bprice\b|\$\s?\d/i)
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    // the page as a whole has no map or location either
    const page_ = (await page.locator('body').innerText()).toLowerCase()
    expect(page_).not.toMatch(/\b(map|gps|location)\b/)
  })

  test('quality gate: the report strings and components', () => {
    const textSource = readFileSync('lib/visits/family-visit-text.ts', 'utf8')
    const componentSource = readFileSync('components/booking/visit-report.tsx', 'utf8')
    const strings = stringsOf
    const reportStrings = (Object.values(FAMILY_REPORT) as unknown[]).filter((v): v is string => typeof v === 'string').join('\n') + '\n' + strings(componentSource) + '\n' + FAMILY_REPORT.loggedAt('09:00 EAT')
    expect(reportStrings).not.toMatch(/\b(arrived|left|on site|failed|missed|incomplete|problem|required|optional)\b/i)
    expect(strings(textSource)).not.toMatch(/\b(arrived|left|on site|location|map|gps)\b/i)

    // unsafe HTML patterns on the report components: none, and no link in the report
    for (const file of ['components/booking/visit-report.tsx', 'components/booking/family-visit-block.tsx']) {
      const source = codeOf(readFileSync(file, 'utf8'))
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|outerHTML|document\.write|markdown|marked|remark|linkify|DOMPurify/i)
    }
    expect(codeOf(componentSource)).not.toMatch(/<a[\s>]|<Link[\s>]|href=/)
    expect(FAMILY_VISIT.heading).toBe('Visit')
  })
})

test.describe('DEV-076 — a caregiver who has since lost Verified (BR-006, AC-014)', () => {
  test('the report is the same, and the caregiver block follows state 4 (the name only)', async ({ page }) => {
    const { family, caregiver, booking } = data.lostVerified
    await open(page, family, booking.id)
    await expect(report(page).getByRole('heading', { name: 'MediCheck Report' })).toBeVisible()
    await expect(taskBlock(page, 'Vitals check')).toContainText('Blood pressure 120/80')
    await expect(page.getByTestId('visit-note-card')).toContainText('Nothing to report')
    const block = page.getByRole('region', { name: 'Caregiver' })
    await expect(block).toContainText(caregiver.fullName)
    await expect(block.getByText('Verified', { exact: true })).toHaveCount(0)
  })
})
