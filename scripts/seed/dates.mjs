// Dates for seed data, in Africa/Nairobi (§7.8(k), DECIDED by the founder).
// Nairobi is UTC+3 all year: there is no daylight saving.

export const NAIROBI_OFFSET_HOURS = 3

/**
 * The instant at `hour`:`minute` Nairobi time, `days` days after today's date IN
 * NAIROBI (which is not always today's date in UTC: from 21:00 UTC it is already
 * tomorrow there). Two calls with the same `days` are on one Nairobi day.
 */
export function nairobiTime({ days = 0, hour = 9, minute = 0, now = new Date() } = {}) {
  const parts = {}
  for (const part of new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)) {
    parts[part.type] = part.value
  }
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + days, hour - NAIROBI_OFFSET_HOURS, minute))
}
