// The order of the Caregiver's My Assignments (DEV-063; FD-VISIT §6.5, §7.8(c), frame VIS-01; FR-011;
// AC-015). The pure function `orderAssignments`:
//
//   1. the visit in progress first (a Caregiver has at most one, BR-007; two would be ordered by the
//      rule below);
//   2. then every booking still assigned whose day has not passed, soonest first;
//   3. then a booking still assigned after its day has passed, last, because without it the passed-day
//      screen could only be reached by a typed address; soonest first among them.
//
// Ties on the visit time are broken by booking id, compared as plain text, so the order is the same every
// time. "Soonest" compares the instants, not the text. Completed visits are never listed (FR-016), and
// neither is anything else that is not assigned or in progress. The input list is not changed.
//
// The day state ('before', 'today' or 'passed') is the database's (caregiver_visit.day_state, worked out
// from the Nairobi calendar and the server's clock), never the device's.

export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'requested'
export type DayState = 'before' | 'today' | 'passed'

export interface OrderableAssignment {
  id: string
  status: AssignmentStatus
  requested_datetime: string
  /** From caregiver_visit; null when the view gave no row. */
  day_state: DayState | null
}

export type AssignmentGroup = 'in-progress' | 'upcoming' | 'passed'

/** The group a listed booking belongs to, or null for one that is not listed at all. */
export function groupOf(assignment: OrderableAssignment): AssignmentGroup | null {
  if (assignment.status === 'in_progress') return 'in-progress'
  if (assignment.status === 'assigned') return assignment.day_state === 'passed' ? 'passed' : 'upcoming'
  return null
}

const time = (assignment: OrderableAssignment) => Date.parse(assignment.requested_datetime)
const byId = (a: OrderableAssignment, b: OrderableAssignment) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const soonest = (a: OrderableAssignment, b: OrderableAssignment) => time(a) - time(b) || byId(a, b)

export function orderAssignments<T extends OrderableAssignment>(assignments: readonly T[]): T[] {
  const inGroup = (group: AssignmentGroup) => assignments.filter((a) => groupOf(a) === group).sort(soonest)
  return [...inGroup('in-progress'), ...inGroup('upcoming'), ...inGroup('passed')]
}
