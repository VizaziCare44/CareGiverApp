// The count line of the family's visit report (DEV-077; FR-007, P1; FD-FAMVIS §5.7(c), §6.5): one plain line
// that says how the tasks ended, e.g. "2 done · 1 not done · 1 not recorded". Pure: it takes the outcomes
// the report already shows (the entry that counts for each task) and returns text.
//
//   - "[n] done", "[n] not done", "[n] not recorded", in that order;
//   - a part whose count is zero is left out;
//   - the parts are joined by " · ";
//   - plain text: no colour, no percentage, no judgement word (no "all", "only", "complete", "missed" ...);
//   - no tasks (or nothing to count) gives null, and the report shows no line.
//
// It is also the first thing to cut if the window is short (§5.7(i), §7.8(c)): the report leaves a place
// for the line, so removing it moves nothing else.

export type CountedOutcome = 'done' | 'not_done' | 'not_recorded'

const PARTS: { outcome: CountedOutcome; words: string }[] = [
  { outcome: 'done', words: 'done' },
  { outcome: 'not_done', words: 'not done' },
  { outcome: 'not_recorded', words: 'not recorded' },
]

export const COUNT_SEPARATOR = ' · '

export function countLine(tasks: { outcome: CountedOutcome }[]): string | null {
  const parts = PARTS.map(({ outcome, words }) => ({ n: tasks.filter((task) => task.outcome === outcome).length, words }))
    .filter(({ n }) => n > 0)
    .map(({ n, words }) => `${n} ${words}`)
  return parts.length > 0 ? parts.join(COUNT_SEPARATOR) : null
}
