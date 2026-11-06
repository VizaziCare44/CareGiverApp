import { MEDICATION_ASSISTANCE_NOTES } from '@/lib/visits/assignment-text'

// The words on Log or change a task (DEV-066; frames VIS-07, VIS-07b, VIS-07c, VIS-07d), as the copy
// table of FD-VISIT §6.5 gives them (checked against it on 2026-11-06, VIZ-91).

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
  tooLong: (limit: number) => `This is too long. The limit is ${LIMIT_WORDS[limit]} characters.`,
  changeLine: 'You can change this until you check out.',
  save: 'Save',
  saveChange: 'Save change',
  loggedAs: (outcome: 'Done' | 'Not done', time: string) =>
    `Logged as ${outcome} on ${time}. You can change it until you check out. The earlier entry stays in the visit record.`,
  tryAgain: 'Try again',
  alreadyCheckedOut: 'This visit was already checked out. Refresh to see the current state.',
  backToAssignment: 'Back to the assignment',
}

export interface TaskField {
  label: string
  /** The helper under the label; none for a plain note (§6.5 gives the label only). */
  prompt: string | null
  /** A line under the field (Vitals check only). */
  after?: string
  /** Whether the text is required for this outcome. */
  required: boolean
}

const READINGS = 'Vitals check'
const NOTES = 'Advocacy and note-taking'
const SUMMARY = 'Post-visit summary'

/** The Reason prompt, by task (§6.5). */
const REASON_PROMPTS: Record<string, string> = {
  'Medication assistance': 'For example: the recipient chose not to take it, or takes no medicines.',
  'Vitals check': 'For example: a reading could not be taken.',
  'Transport and escort': 'For example: the appointment was cancelled.',
  'Advocacy and note-taking': 'For example: the appointment was cancelled.',
  'Post-visit summary': 'For example: the appointment was cancelled.',
  Companionship: 'For example: the recipient was resting.',
  'Pre-visit preparation': 'For example: the appointment time changed.',
}

/** The field under the outcome buttons: which one, what it is called, and its prompt (§6.5). */
export function fieldFor(taskName: string, outcome: 'done' | 'not_done', noteRequired: boolean): TaskField {
  if (outcome === 'not_done') {
    return { label: 'Reason (required)', prompt: REASON_PROMPTS[taskName] ?? null, required: true }
  }
  if (taskName === READINGS) {
    return {
      label: 'Readings (required)',
      prompt: 'Type the readings you took, for example blood pressure and glucose.',
      after: 'Saving a reading does not alert anyone. If you are worried, phone the Admin or the emergency services.',
      required: true,
    }
  }
  if (taskName === NOTES) {
    return { label: 'Notes (required)', prompt: 'Write down what was discussed or asked at the appointment. The family will read this after you check out.', required: true }
  }
  if (taskName === SUMMARY) {
    return {
      label: 'Summary (required)',
      prompt: "Write down the doctor's instructions, any new prescriptions and the next steps, in plain words. The family will read this after you check out.",
      required: true,
    }
  }
  return { label: noteRequired ? 'Note (required)' : 'Note (optional)', prompt: null, required: noteRequired }
}

export const isMedicationAssistance = (taskName: string) => taskName === MEDICATION_ASSISTANCE_NOTES.taskName

/** Characters as the database counts them (code points), so an emoji is one. */
export const lengthOf = (text: string) => Array.from(text.trim()).length
