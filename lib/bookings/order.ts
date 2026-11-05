// The order of the family's My Bookings (DEV-078; FD-FAMVIS §7.3, decision 14 of §15; FR-001, FR-013;
// AC-012). The pure function `orderBookings`, which replaces DEV-044's soonest-first sort:
//
//   1. in progress first; two in progress are ordered soonest requested_datetime first, then booking id;
//   2. then every booking that is neither in progress nor completed (requested, assigned, cancelled),
//      soonest first, ties by booking id;
//   3. then completed, newest first, ties by booking id.
//
// "Soonest" and "newest" compare the instants, not the text, so a time written with another offset
// sorts correctly. A tie on the id is compared as plain text, ascending, so the order is the same
// every time. No pagination. The input list is not changed.

export interface OrderableBooking {
  id: string
  status: string
  requested_datetime: string
}

const time = (booking: OrderableBooking) => Date.parse(booking.requested_datetime)
const byId = (a: OrderableBooking, b: OrderableBooking) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const soonest = (a: OrderableBooking, b: OrderableBooking) => time(a) - time(b) || byId(a, b)
const newest = (a: OrderableBooking, b: OrderableBooking) => time(b) - time(a) || byId(a, b)

export function orderBookings<T extends OrderableBooking>(bookings: readonly T[]): T[] {
  const inProgress = bookings.filter((b) => b.status === 'in_progress').sort(soonest)
  const ahead = bookings.filter((b) => b.status !== 'in_progress' && b.status !== 'completed').sort(soonest)
  const completed = bookings.filter((b) => b.status === 'completed').sort(newest)
  return [...inProgress, ...ahead, ...completed]
}
