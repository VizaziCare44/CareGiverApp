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
