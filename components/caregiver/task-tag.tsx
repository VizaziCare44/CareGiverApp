import { CHECKLIST } from '@/lib/visits/assignment-text'

// "Tag Required" and "Tag Optional" of the Caregiver frames (VIS-02 to VIS-09): Required is a pill outlined in the ink
// colour, 13px semibold; Optional is the same size in plain muted text. The word says it, so it is never colour alone.
export function TaskTag({ required }: { required: boolean }) {
  return required ? (
    <span className="inline-flex items-center rounded-full border border-figma-ink px-2 py-0.5 text-[13px] font-semibold leading-[1.4] text-figma-ink">
      {CHECKLIST.required}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 text-[13px] leading-[1.4] text-figma-muted">{CHECKLIST.optional}</span>
  )
}
