import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppBar } from '@/components/ui/app-bar'
import { ActionLink } from '@/components/ui/action-button'
import { BookingUnavailable } from '@/components/caregiver/booking-unavailable'
import { LogTaskForm, type CurrentEntry } from '@/components/caregiver/log-task-form'
import { CHECKLIST, MEDICATION_ASSISTANCE_NOTES } from '@/lib/visits/assignment-text'
import { LOG_TASK, isMedicationAssistance } from '@/lib/visits/log-task-text'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface TaskRow {
  task_id: string
  name: string
  required: boolean
  note_required: boolean
  outcome: 'done' | 'not_done' | null
  note: string | null
  reason: string | null
  logged_at: string | null
}

// DEV-066 (frames VIS-07 to VIS-07d): log a task of the visit in progress, or change it. Read
// through the same views as Assignment Detail (migrations 0013 and 0014), so a Caregiver who is
// not Verified, a task on someone else's visit and a made-up id all get the one "no longer
// available" message and nothing else. After check-out the screen says so and offers no edit.
export default async function LogTaskPage({ params }: { params: { id: string; taskId: string } }) {
  if (!UUID.test(params.id) || !UUID.test(params.taskId)) notFound()

  const supabase = await createClient()

  const { data: taskData, error: taskError } = await supabase
    .from('caregiver_visit_tasks')
    .select('task_id, name, required, note_required, outcome, note, reason, logged_at')
    .eq('booking_id', params.id)
    .eq('task_id', params.taskId)
    .maybeSingle()
  if (taskError) throw new Error(`Failed to load the task: ${taskError.message}`)
  const task = taskData as TaskRow | null
  if (!task) return <BookingUnavailable />

  const { data: visitData, error: visitError } = await supabase
    .from('caregiver_visit')
    .select('checked_out_at')
    .eq('booking_id', params.id)
    .maybeSingle()
  if (visitError) throw new Error(`Failed to load the visit: ${visitError.message}`)
  const checkedOut = Boolean((visitData as { checked_out_at: string | null } | null)?.checked_out_at)

  const current: CurrentEntry | null =
    task.outcome && task.logged_at ? { outcome: task.outcome, note: task.note, reason: task.reason, loggedAt: task.logged_at } : null

  return (
    <div className="min-h-screen text-figma-ink">
      <AppBar title={LOG_TASK.title} backHref={`/assignments/${params.id}`} backLabel={LOG_TASK.backToAssignment} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-9">{task.name}</h1>
          <p className="text-[14px] text-figma-muted">{task.required ? CHECKLIST.required : CHECKLIST.optional}</p>
        </div>

        {isMedicationAssistance(task.name) && (
          <div className="flex flex-col gap-2 rounded-xl border border-figma-line bg-white p-4 text-[14px] leading-[1.4]" data-testid="medication-help">
            <p>{MEDICATION_ASSISTANCE_NOTES.description}</p>
            <p>{MEDICATION_ASSISTANCE_NOTES.ifUnsure}</p>
          </div>
        )}

        {checkedOut ? (
          <div className="flex flex-col gap-4" data-testid="already-checked-out">
            <p className="text-[16px] leading-[1.4]">{LOG_TASK.alreadyCheckedOut}</p>
            <ActionLink href={`/assignments/${params.id}`} variant="secondary" className="self-start">
              {LOG_TASK.backToAssignment}
            </ActionLink>
          </div>
        ) : (
          <LogTaskForm
            // a new entry elsewhere (another device) gives a fresh form, not stale typing
            key={`${task.task_id}-${task.logged_at ?? 'none'}`}
            bookingId={params.id}
            taskId={task.task_id}
            taskName={task.name}
            noteRequired={task.note_required}
            current={current}
          />
        )}
      </main>
    </div>
  )
}
