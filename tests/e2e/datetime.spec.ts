import { test, expect } from '@playwright/test'
import { formatDate, formatDateTime, formatTime, nairobiToday, slotToInstant } from '../../lib/datetime'

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

// A slot typed in the booking flow is Nairobi time, whatever zone the browser is in.
for (const zone of ['Africa/Nairobi', 'America/Los_Angeles', 'UTC']) {
  test.describe(`typed slots, process time zone ${zone}`, () => {
    let original: string | undefined
    test.beforeAll(() => {
      original = process.env.TZ
      process.env.TZ = zone
    })
    test.afterAll(() => {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    })

    test('a slot is read as Nairobi time and stored as that instant', () => {
      expect(slotToInstant('2026-10-14', '09:00')).toBe('2026-10-14T06:00:00.000Z')
      expect(slotToInstant('2026-10-14', '09:00:30')).toBe('2026-10-14T06:00:30.000Z')
      // around midnight: 00:30 Nairobi is still the day before in UTC
      expect(slotToInstant('2026-10-15', '00:30')).toBe('2026-10-14T21:30:00.000Z')
      expect(slotToInstant('2026-10-14', '23:59')).toBe('2026-10-14T20:59:00.000Z')
      // and it reads back as the same date and time
      expect(formatDateTime(slotToInstant('2026-10-15', '00:30'))).toBe('Thu 15 Oct 2026, 00:30 EAT')
      expect(formatDateTime(slotToInstant('2026-12-31', '23:59'))).toBe('Thu 31 Dec 2026, 23:59 EAT')
    })

    test('"today" is the date in Nairobi, including after 21:00 UTC', () => {
      expect(nairobiToday(new Date('2026-10-14T20:59:00Z'))).toBe('2026-10-14')
      expect(nairobiToday(new Date('2026-10-14T21:00:00Z'))).toBe('2026-10-15')
      expect(nairobiToday(new Date('2026-12-31T21:30:00Z'))).toBe('2027-01-01')
      expect(nairobiToday(new Date('2026-10-14T00:30:00Z'))).toBe('2026-10-14')
    })

    test('a value that is not a date and a time is refused', () => {
      for (const [date, time] of [['', '09:00'], ['2026-10-14', ''], ['2026-13-40', '09:00'], ['2026-10-14', '25:00'], ['275760-01-01', '09:00']]) {
        expect(() => slotToInstant(date, time), `${date} ${time}`).toThrow('Not a date and time')
      }
    })
  })
}
