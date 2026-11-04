// The probe (DEV-070; FD-VISIT §7.3 item 13): reads the visit data with the service role and lists
// every row that breaks a rule the visit functions and the triggers keep. An empty list is a pass. It
// is read-only and is used only after an attempt, never as the caller of a permission case.
//
// §7.3 itself was not available when this was written, so the list of rules is the one the
// functions and triggers of migrations 0011 to 0016 keep (DRAFT):
//   BOOKING_WITHOUT_VISIT      a booking in progress or completed that has no visit
//   STATUS_MISMATCH            an open visit whose booking is not in progress, or a closed one whose
//                              booking is not completed
//   WRONG_CAREGIVER            the visit's Caregiver is not the booking's assigned Caregiver
//   SNAPSHOT_MISMATCH          the visit's tasks are not the bundle's checklist (names, order,
//                              Required, note needed)
//   REQUIRED_TASK_NOT_LOGGED   a closed visit with a Required task that has no entry
//   ENTRY_OUTSIDE_VISIT        an entry logged before check-in or after check-out
//   ENTRY_WITHOUT_TEXT         a Done entry without the note its task needs, or a Not done entry
//                              without a reason
//   TWO_OPEN_VISITS            a Caregiver with more than one open visit
//   CLOSED_BEFORE_OPEN         checked out before checked in
// `bookingIds` limits it to those bookings (a test checks its own); without it, every visit.

const PAGE = 1000

async function readAll(build) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(`the probe could not read: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  return rows
}

const inChunks = async (ids, read) => {
  const rows = []
  for (let i = 0; i < ids.length; i += 100) rows.push(...(await read(ids.slice(i, i + 100))))
  return rows
}

export async function probe(supabase, { bookingIds } = {}) {
  const offenders = []
  const add = (kind, detail) => offenders.push({ kind, ...detail })

  const bookings = bookingIds
    ? await inChunks(bookingIds, (ids) => readAll(() => supabase.from('bookings').select('id, status, bundle_code, assigned_caregiver_id').in('id', ids).order('id')))
    : await readAll(() => supabase.from('bookings').select('id, status, bundle_code, assigned_caregiver_id').in('status', ['in_progress', 'completed']).order('id'))
  const visits = bookingIds
    ? await inChunks(bookingIds, (ids) => readAll(() => supabase.from('visits').select('id, booking_id, caregiver_id, checked_in_at, checked_out_at').in('booking_id', ids).order('id')))
    : await readAll(() => supabase.from('visits').select('id, booking_id, caregiver_id, checked_in_at, checked_out_at').order('id'))

  const bookingById = new Map(bookings.map((b) => [b.id, b]))
  if (!bookingIds) {
    // a visit whose booking was not in the in-progress / completed read above: read it
    const missing = [...new Set(visits.map((v) => v.booking_id).filter((id) => !bookingById.has(id)))]
    for (const b of await inChunks(missing, (ids) => readAll(() => supabase.from('bookings').select('id, status, bundle_code, assigned_caregiver_id').in('id', ids).order('id')))) bookingById.set(b.id, b)
  }
  const visitByBooking = new Map(visits.map((v) => [v.booking_id, v]))

  for (const booking of bookingById.values()) {
    if ((booking.status === 'in_progress' || booking.status === 'completed') && !visitByBooking.has(booking.id)) add('BOOKING_WITHOUT_VISIT', { bookingId: booking.id, status: booking.status })
  }

  const items = await readAll(() => supabase.from('checklist_items').select('id, bundle_code, sort_order, name, required, note_required').order('id'))
  const tasks = await inChunks(visits.map((v) => v.id), (ids) =>
    readAll(() => supabase.from('visit_tasks').select('id, visit_id, checklist_item_id, sort_order, name, required, note_required').in('visit_id', ids).order('id')),
  )
  const entries = await inChunks(tasks.map((t) => t.id), (ids) =>
    readAll(() => supabase.from('visit_task_entries').select('id, visit_task_id, outcome, note, reason, logged_at').in('visit_task_id', ids).order('id')),
  )

  const tasksByVisit = new Map()
  for (const task of tasks) tasksByVisit.set(task.visit_id, [...(tasksByVisit.get(task.visit_id) ?? []), task])
  const entriesByTask = new Map()
  for (const entry of entries) entriesByTask.set(entry.visit_task_id, [...(entriesByTask.get(entry.visit_task_id) ?? []), entry])

  const open = new Map()
  for (const visit of visits) {
    const booking = bookingById.get(visit.booking_id)
    const closed = visit.checked_out_at !== null
    if (booking && booking.status !== (closed ? 'completed' : 'in_progress')) add('STATUS_MISMATCH', { visitId: visit.id, visitClosed: closed, bookingStatus: booking.status })
    if (booking && booking.assigned_caregiver_id !== visit.caregiver_id) add('WRONG_CAREGIVER', { visitId: visit.id })
    if (closed && new Date(visit.checked_out_at) < new Date(visit.checked_in_at)) add('CLOSED_BEFORE_OPEN', { visitId: visit.id })
    if (!closed) open.set(visit.caregiver_id, [...(open.get(visit.caregiver_id) ?? []), visit.id])

    const own = (tasksByVisit.get(visit.id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const checklist = booking ? items.filter((i) => i.bundle_code === booking.bundle_code).sort((a, b) => a.sort_order - b.sort_order) : []
    const same =
      own.length === checklist.length &&
      own.every((t, i) => t.name === checklist[i].name && t.sort_order === checklist[i].sort_order && t.required === checklist[i].required && t.note_required === checklist[i].note_required)
    if (booking && !same) add('SNAPSHOT_MISMATCH', { visitId: visit.id })

    for (const task of own) {
      const list = entriesByTask.get(task.id) ?? []
      if (closed && task.required && list.length === 0) add('REQUIRED_TASK_NOT_LOGGED', { visitId: visit.id, task: task.name })
      for (const entry of list) {
        const at = new Date(entry.logged_at)
        if (at < new Date(visit.checked_in_at) || (closed && at > new Date(visit.checked_out_at))) add('ENTRY_OUTSIDE_VISIT', { visitId: visit.id, task: task.name, entryId: entry.id })
        if ((entry.outcome === 'not_done' && !entry.reason) || (entry.outcome === 'done' && task.note_required && !entry.note)) add('ENTRY_WITHOUT_TEXT', { visitId: visit.id, task: task.name, entryId: entry.id })
      }
    }
  }
  for (const [caregiverId, ids] of open) if (ids.length > 1) add('TWO_OPEN_VISITS', { caregiverId, visitIds: ids })

  return offenders
}
