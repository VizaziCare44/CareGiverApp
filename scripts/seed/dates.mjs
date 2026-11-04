// Dates for seed data, in Africa/Nairobi (§7.8(k), DECIDED by the founder).
// Nairobi is UTC+3 all year: there is no daylight saving.

export const NAIROBI_OFFSET_HOURS = 3

function nairobiParts(instant) {
  const parts = {}
  for (const part of new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)) {
    parts[part.type] = part.value
  }
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
}

/**
 * The instant at `hour`:`minute` Nairobi time, `days` days after today's date IN
 * NAIROBI (which is not always today's date in UTC: from 21:00 UTC it is already
 * tomorrow there). Two calls with the same `days` are on one Nairobi day.
 */
export function nairobiTime({ days = 0, hour = 9, minute = 0, now = new Date() } = {}) {
  const { year, month, day } = nairobiParts(now)
  return new Date(Date.UTC(year, month - 1, day + days, hour - NAIROBI_OFFSET_HOURS, minute))
}

/** The instant at `hour`:`minute` Nairobi time on the Nairobi calendar day that `instant` falls on. */
export function nairobiOnDayOf(instant, { hour = 9, minute = 0 } = {}) {
  const { year, month, day } = nairobiParts(new Date(instant))
  return new Date(Date.UTC(year, month - 1, day, hour - NAIROBI_OFFSET_HOURS, minute))
}
