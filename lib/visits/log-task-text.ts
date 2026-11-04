import { MEDICATION_ASSISTANCE_NOTES } from '@/lib/visits/assignment-text'

// The words on Log or change a task (DEV-066; frames VIS-07, VIS-07b, VIS-07c, VIS-07d). The
// lines and prompts the ticket gives are exact. The Reason and plain Note prompts, and the
// "already checked out" message, come from FD-VISIT §6.5, which was not available: DRAFT.

export const NOTE_LIMIT = 2000
export const REASON_LIMIT = 500
const LIMIT_WORDS: Record<number, string> = { 2000: '2,000', 500: '500' }

export const LOG_TASK = {
  title: 'Log task',
  outcomeLegend: 'Outcome',
  done: 'Done',
  notDone: 'Not done',
  noteNeeded: 'A note is needed to log this task as Done.',
  reasonNeeded: 'A reason is needed to log this task as Not done.',
  tooLong: (limit: number) => `This is too long. The limit is ${LIMIT_WORDS[limit]} characters. Shorten it to save.`,
  changeLine: 'You can change this until you check out.',
  save: 'Save',
  saveChange: 'Save change',
  loggedAs: (outcome: 'Done' | 'Not done', time: string) =>
    `Logged as ${outcome} on ${time}. You can change it until you check out. The earlier entry stays in the visit record.`,
  tryAgain: 'Try again',
  /** DRAFT */
  alreadyCheckedOut: 'This visit is already checked out, so its tasks can no longer be changed.',
  backToAssignment: 'Back to the assignment',
}

export interface TaskField {
  label: string
  prompt: string
  /** A line under the field (Vitals check only). */
  after?: string
  /** Whether the text is required for this outcome. */
  required: boolean
}

const READINGS = 'Vitals check'
const NOTES = 'Advocacy and note-taking'
const SUMMARY = 'Post-visit summary'

/** The field under the outcome buttons: which one, what it is called, and its prompt (§6.5). */
export function fieldFor(taskName: string, outcome: 'done' | 'not_done', noteRequired: boolean): TaskField {
  if (outcome === 'not_done') {
    // DRAFT: the prompt by task is in §6.5; one prompt until it can be copied
    return { label: 'Reason (required)', prompt: 'Say why this task was not done.', required: true }
  }
  if (taskName === READINGS) {
    return {
      label: 'Readings',
      prompt: 'Type the readings you took, for example blood pressure and glucose.',
      after: 'Saving a reading does not alert anyone. If you are worried, phone the Admin or the emergency services.',
      required: true,
    }
  }
  if (taskName === NOTES) {
    return { label: 'Notes', prompt: 'Write down what was discussed or asked at the appointment. The family will read this after you check out.', required: true }
  }
  if (taskName === SUMMARY) {
    return {
      label: 'Summary',
      prompt: "Write down the doctor's instructions, any new prescriptions and the next steps, in plain words. The family will read this after you check out.",
      required: true,
    }
  }
  // DRAFT prompt for the plain note
  return { label: noteRequired ? 'Note (required)' : 'Note (optional)', prompt: 'Add anything the family or Vizazi Care should know.', required: noteRequired }
}

export const isMedicationAssistance = (taskName: string) => taskName === MEDICATION_ASSISTANCE_NOTES.taskName

/** Characters as the database counts them (code points), so an emoji is one. */
export const lengthOf = (text: string) => Array.from(text.trim()).length
