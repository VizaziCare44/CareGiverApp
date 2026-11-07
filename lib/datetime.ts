// Shared date-time formatting (DEV-068, §7.1/§7.8(i)). Turns a stored timestamp
// into text in Africa/Nairobi, always, whatever the viewer's device or the
// server's zone (Vercel servers run in UTC), in the form "Wed 14 Oct 2026,
// 09:04 EAT". Screens format dates and times only through this module.

export const TIME_ZONE = 'Africa/Nairobi'
export const ZONE_LABEL = 'EAT'

type DateInput = Date | string | number

// en-US only for the day and month names, which are fixed to "Mon" … "Sun" and
// "Jan" … "Dec" (en-GB abbreviates September as "Sept"); the order of the
// parts is ours, assembled below.
function partsOf(value: DateInput, options: Intl.DateTimeFormatOptions) {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options }).formatToParts(new Date(value))) {
    parts[part.type] = part.value
  }
  return parts
}

/** "Wed 14 Oct 2026" */
export function formatDate(value: DateInput) {
  const p = partsOf(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`
}

/** "09:04 EAT" */
export function formatTime(value: DateInput) {
  const p = partsOf(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${p.hour}:${p.minute} ${ZONE_LABEL}`
}

/** "Wed 14 Oct 2026, 09:04 EAT" */
export function formatDateTime(value: DateInput) {
  return `${formatDate(value)}, ${formatTime(value)}`
}

/**
 * A span of time as the Admin's Exceptions screen writes it (T5, FD-ADMINEXC decision 7): whole units, rounded
 * down. Under 120 minutes it reads "N minutes"; from 120 minutes to 47 hours, "N hours"; from 48 hours,
 * "N days". The view returns minutes; this is the one place they become words. Every span on that screen is
 * 30 minutes or more, so there is no singular form.
 */
export function formatSpan(minutes: number) {
  const whole = Math.max(0, Math.floor(minutes))
  if (whole < 120) return `${whole} minutes`
  if (whole < 48 * 60) return `${Math.floor(whole / 60)} hours`
  return `${Math.floor(whole / (24 * 60))} days`
}

// A slot typed in the booking flow (a date and a time of day from the pickers) is
// Nairobi time, whatever zone the browser is in (FD-VERIFY §7.8(k)). Nairobi is UTC+3
// all year, with no daylight saving.
const OFFSET = '+03:00'

/** Today's date in Nairobi as "2026-10-14", for the date picker's earliest day. */
export function nairobiToday(now: Date = new Date()) {
  const p = partsOf(now, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * The moment a typed slot means, as an ISO timestamp to store: "2026-10-14" and
 * "09:00" are 09:00 in Nairobi, that is 06:00 UTC. Throws on a value that is not a
 * real date and time.
 */
export function slotToInstant(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    throw new Error(`Not a date and time: "${date}" "${time}"`)
  }
  const instant = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${OFFSET}`)
  if (Number.isNaN(instant.getTime())) throw new Error(`Not a date and time: "${date}" "${time}"`)
  return instant.toISOString()
}

/**
 * The month calendar of Date/Time Selection (ACC-08): a month's name ("October 2026"), how many days it has, and how
 * many empty cells come before the 1st when the week starts on Monday. Calendar arithmetic only, on plain year and
 * month numbers; no zone is involved, so it is the same on every device. `month` is 1 to 12.
 */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  return {
    label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first),
    days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    leading: (first.getUTCDay() + 6) % 7,
  }
}
