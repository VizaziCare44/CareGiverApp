import { test, expect } from '@playwright/test'
import { groupOf, orderAssignments, type OrderableAssignment } from '../../lib/assignments/order'

// DEV-063 (FD-VISIT §6.5, §7.8(c); FR-011, FR-016; AC-015): the order of the Caregiver's My Assignments, as a pure
// function with no browser and no database. The visit in progress first; then the bookings still to come,
// soonest first; a booking still assigned after its day has passed last; completed visits never listed.

const at = (id: string, status: OrderableAssignment['status'], requested: string, day_state: OrderableAssignment['day_state'] = 'before'): OrderableAssignment => ({
  id,
  status,
  requested_datetime: requested,
  day_state,
})

test.describe('DEV-063 — orderAssignments', () => {
  test('in progress first, then the bookings to come soonest first, then the passed day last', () => {
    const list = [
      at('d', 'assigned', '2030-01-10T06:00:00.000Z', 'passed'),
      at('u1', 'assigned', '2030-01-17T06:00:00.000Z'),
      at('p', 'in_progress', '2030-01-15T06:00:00.000Z', 'today'),
      at('u2', 'assigned', '2030-01-16T11:00:00.000Z'),
      at('t', 'assigned', '2030-01-15T11:00:00.000Z', 'today'),
    ]
    expect(orderAssignments(list).map((a) => a.id)).toEqual(['p', 't', 'u2', 'u1', 'd'])
  })

  test('a passed day is last even when it is the soonest of all; several passed days are soonest first', () => {
    const list = [at('late', 'assigned', '2030-01-09T06:00:00.000Z', 'passed'), at('early', 'assigned', '2030-01-08T06:00:00.000Z', 'passed'), at('next', 'assigned', '2030-02-01T06:00:00.000Z')]
    expect(orderAssignments(list).map((a) => a.id)).toEqual(['next', 'early', 'late'])
  })

  test('completed, cancelled and requested bookings are not listed (FR-016)', () => {
    const list = [at('c', 'completed', '2030-01-15T06:00:00.000Z', 'today'), at('x', 'cancelled', '2030-01-15T06:00:00.000Z'), at('r', 'requested', '2030-01-15T06:00:00.000Z'), at('a', 'assigned', '2030-01-16T06:00:00.000Z')]
    expect(orderAssignments(list).map((a) => a.id)).toEqual(['a'])
    expect(groupOf(list[0])).toBeNull()
  })

  test('ties on the visit time are broken by booking id, the same every time; the instant is compared, not the text', () => {
    const same = '2030-01-15T06:00:00.000Z'
    const forward = [at('b', 'assigned', same), at('a', 'assigned', same), at('c', 'assigned', same)]
    expect(orderAssignments(forward).map((a) => a.id)).toEqual(['a', 'b', 'c'])
    expect(orderAssignments([...forward].reverse()).map((a) => a.id)).toEqual(['a', 'b', 'c'])
    // 09:00 at +03:00 is 06:00 UTC: the same instant written two ways, then the later one
    const mixed = [at('z', 'assigned', '2030-01-15T09:00:00.000+03:00'), at('y', 'assigned', '2030-01-15T06:30:00.000Z'), at('x', 'assigned', '2030-01-15T06:00:00.000Z')]
    expect(orderAssignments(mixed).map((a) => a.id)).toEqual(['x', 'z', 'y'])
  })

  test('a booking with no day state is treated as still to come, and the input is not changed', () => {
    const list = [at('b', 'assigned', '2030-01-16T06:00:00.000Z', null), at('a', 'assigned', '2030-01-15T06:00:00.000Z', 'passed')]
    const snapshot = JSON.stringify(list)
    expect(orderAssignments(list).map((a) => a.id)).toEqual(['b', 'a'])
    expect(JSON.stringify(list)).toBe(snapshot)
    expect(orderAssignments([])).toEqual([])
  })
})
