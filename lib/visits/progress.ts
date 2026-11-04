// What the in-progress Assignment Detail works out from the tasks of a visit (DEV-065):
// how many Required tasks have an outcome, which are still to log, and whether the
// Optional task is the only one left. Pure functions, so they are unit-tested on their own.
// A Required task logged Not done counts as logged (FR-005): it has an outcome.

export type TaskOutcome = 'done' | 'not_done'

export interface VisitTask {
  task_id: string
  name: string
  required: boolean
  outcome: TaskOutcome | null
}

const isLogged = (task: VisitTask) => task.outcome !== null

/** Required tasks that have an outcome, and how many Required tasks there are. */
export function requiredProgress(tasks: VisitTask[]) {
  const required = tasks.filter((task) => task.required)
  return { logged: required.filter(isLogged).length, total: required.length }
}

/** Names of the Required tasks with no outcome, in checklist order (the order of `tasks`). */
export function stillToLog(tasks: VisitTask[]) {
  return tasks.filter((task) => task.required && !isLogged(task)).map((task) => task.name)
}

/** Check out is available once every Required task has an outcome. */
export const canCheckOut = (tasks: VisitTask[]) => stillToLog(tasks).length === 0

/**
 * The name of the Optional task when it has no outcome yet, else null. Each bundle has
 * exactly one Optional task, so there is no plural form (§6.6(k)(h)); if there were ever
 * more than one, the first still unlogged is named.
 */
export function unloggedOptionalName(tasks: VisitTask[]) {
  return tasks.find((task) => !task.required && !isLogged(task))?.name ?? null
}
