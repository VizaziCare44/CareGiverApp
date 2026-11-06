import { test, expect } from '@playwright/test'
import { formatSpan } from '../../lib/datetime'
import { EXCEPTIONS_TEXT, EXCEPTION_DETAILS, EXCEPTION_LABELS } from '../../lib/admin/exceptions-text'

// DEV-080 (FD-ADMINEXC §7, AC-011, AC-016): the parts of the Exceptions screen that need no browser, no database and
// no test clock, so they run everywhere, the shared dev project included: formatSpan (T5) and the words.

test.describe('DEV-080 — formatSpan (T5, AC-016): whole units, rounded down', () => {
  test('119 minutes reads as minutes and 120 as 2 hours; 47 hours reads 47 hours and 48 hours reads 2 days; 71 hours reads 2 days', () => {
    expect(formatSpan(30)).toBe('30 minutes')
    expect(formatSpan(119)).toBe('119 minutes')
    expect(formatSpan(120)).toBe('2 hours')
    expect(formatSpan(125)).toBe('2 hours')
    expect(formatSpan(8 * 60)).toBe('8 hours')
    expect(formatSpan(47 * 60)).toBe('47 hours')
    expect(formatSpan(47 * 60 + 59)).toBe('47 hours')
    expect(formatSpan(48 * 60)).toBe('2 days')
    expect(formatSpan(71 * 60)).toBe('2 days')
    expect(formatSpan(72 * 60)).toBe('3 days')
    expect(formatSpan(7 * 24 * 60)).toBe('7 days')
    // a fraction is rounded down, never up
    expect(formatSpan(119.9)).toBe('119 minutes')
    expect(formatSpan(-5)).toBe('0 minutes')
  })

  test('the words of the screen: the six labels, the detail lines and the strings (§7), and none of the banned words (AC-011)', () => {
    expect(Object.values(EXCEPTION_LABELS).map((entry) => entry.label)).toEqual([
      'No check-in yet',
      'Checked in late',
      'Still in progress',
      'Required task not done',
      'Caregiver no longer Verified',
      'Visit record missing',
    ])
    expect(EXCEPTION_DETAILS.e1('31 minutes')).toBe('31 minutes after the requested time')
    expect(EXCEPTION_DETAILS.e2('45 minutes')).toBe('Checked in 45 minutes after the requested time')
    expect(EXCEPTION_DETAILS.e3('9 hours')).toBe('Checked in 9 hours ago. No check-out recorded.')
    expect(EXCEPTION_DETAILS.e4Reason('Cancelled')).toBe('Reason: Cancelled')
    expect(EXCEPTION_DETAILS.e5('Test Caregiver')).toBe('Test Caregiver is not Verified now.')
    expect(EXCEPTION_DETAILS.e6('Completed')).toBe('Booking status is Completed. No visit record found.')
    expect(EXCEPTIONS_TEXT.intro).toBe('Last 7 days. This list sends no alerts.')
    expect(EXCEPTIONS_TEXT.emptyHeading).toBe('No exceptions from the last 7 days')
    expect(EXCEPTIONS_TEXT.emptyBody).toBe('None of the situations this screen looks for was found. It says nothing else about the visits.')
    expect(EXCEPTIONS_TEXT.error).toBe("Couldn't load exceptions — check your connection and try again.")

    const strings = JSON.stringify([EXCEPTIONS_TEXT, EXCEPTION_LABELS, EXCEPTION_DETAILS.e1('x'), EXCEPTION_DETAILS.e2('x'), EXCEPTION_DETAILS.e3('x'), EXCEPTION_DETAILS.e6('x')]).toLowerCase()
    for (const banned of ['failed', 'missed', 'incomplete', 'problem', 'overdue', 'absent', 'error code']) expect(strings, banned).not.toContain(banned)
  })
})
