import { test, expect } from '@playwright/test'
import { formatDate, formatDateTime, formatTime } from '../../lib/datetime'

// DEV-068 (core module): stored timestamps are always shown in Africa/Nairobi,
// whatever zone the process runs in. Plain function tests, no browser.

const cases: Array<[string, string, string, string]> = [
  // stored value (UTC), date, time, date-time
  ['2026-10-14T06:04:00Z', 'Wed 14 Oct 2026', '09:04 EAT', 'Wed 14 Oct 2026, 09:04 EAT'],
  ['2026-10-14T20:59:00Z', 'Wed 14 Oct 2026', '23:59 EAT', 'Wed 14 Oct 2026, 23:59 EAT'],
  // the UTC date change: 21:00 UTC is already midnight of the next day in Nairobi
  ['2026-10-14T21:00:00Z', 'Thu 15 Oct 2026', '00:00 EAT', 'Thu 15 Oct 2026, 00:00 EAT'],
  ['2026-12-31T21:30:00Z', 'Fri 1 Jan 2027', '00:30 EAT', 'Fri 1 Jan 2027, 00:30 EAT'],
  // every month is three letters ("Sep", not "Sept"), every weekday three letters
  ['2026-09-28T09:00:00Z', 'Mon 28 Sep 2026', '12:00 EAT', 'Mon 28 Sep 2026, 12:00 EAT'],
  ['2026-06-04T10:00:00Z', 'Thu 4 Jun 2026', '13:00 EAT', 'Thu 4 Jun 2026, 13:00 EAT'],
  ['2026-07-14T10:00:00Z', 'Tue 14 Jul 2026', '13:00 EAT', 'Tue 14 Jul 2026, 13:00 EAT'],
]

for (const zone of ['Africa/Nairobi', 'America/Los_Angeles', 'UTC']) {
  test.describe(`process time zone ${zone}`, () => {
    let original: string | undefined

    test.beforeAll(() => {
      original = process.env.TZ
      process.env.TZ = zone
    })
    test.afterAll(() => {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    })

    for (const [stored, date, time, dateTime] of cases) {
      test(`${stored}`, () => {
        expect(formatDate(stored)).toBe(date)
        expect(formatTime(stored)).toBe(time)
        expect(formatDateTime(stored)).toBe(dateTime)
        expect(formatDateTime(new Date(stored))).toBe(dateTime)
      })
    }
  })
}
