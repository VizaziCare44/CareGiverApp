const fs = require('fs')
function sub(file, pairs) {
  let s = fs.readFileSync(file, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(file + ': missing ' + a.slice(0, 70))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(file, s)
}
sub('docs/FD-VISIT Runbook Addendum.md', [
  ['### 0014 `visit_task_views` (DEV-061, draft)', '### 0014 `visit_task_views` (draft)'],
  ["   set visit_note = visit_note || E'\n' || 'Corrected by <name> (Tech Lead) on <date>: <what and why> (<ticket>)'",
   "   set visit_note = coalesce(visit_note || E'\n', '') || 'Corrected by <name> (Tech Lead) on <date>: <what and why> (<ticket>)'"],
  ['The booking, the Caregiver and the check-in time cannot be changed even with the guard off', 'The note stays under 2,000 characters in all. The booking, the Caregiver and the check-in time cannot be changed even with the guard off'],
])
sub('backend-config/supabase/tests/database/0017_visit_release_checks.test.sql', [
  ["update public.visits set visit_note = 'Closed by the Tech Lead on 2026-11-05: the Caregiver could not log it (test). Corrected on 2026-11-06: typo (test)'\n where id = '00000000-0000-0000-0000-0000000000a2';",
   "update public.visits\n   set visit_note = coalesce(visit_note || E'\n', '') || 'Corrected by the Tech Lead on 2026-11-06: typo (test)'\n where id = '00000000-0000-0000-0000-0000000000a2';"],
  ["select is((select visit_note like '%Corrected on 2026-11-06%' from public.visits", "select is((select visit_note like 'Closed by the Tech Lead%' and visit_note like '%Corrected by the Tech Lead on 2026-11-06%' from public.visits"],
  ["case 2: the correction is in the visit note", "case 2: the correction is added to the visit note, and what was there stays"],
])
sub('docs/Production Release Runbook.md', [
  [`> **FD-VISIT drafts, 0011 to 0013 (DEV-064).** \`0011_visit_schema\`, \`0012_check_in\` and \`0013_caregiver_visit_view\` are in the folder but are **not part of this release**: they were written from the task texts while FD-VISIT was not available, and are to be checked against FD-VISIT section 7 first. Until DEV-071 (the FD-VISIT runbook addendum) adds them to this list, do not run \`supabase db push\` against production with these files present: move them out of the folder or push only up to 0010 (\`supabase db push --include-all\` is not needed; use a branch that does not contain them). The numbers below ("all ten") are for the FD-VERIFY release.`,
   `> **FD-VISIT drafts, 0011 to 0017.** The visit migrations (\`0011_visit_schema\` to \`0017_test_clock_per_caregiver\`) are in the folder but are **not part of the FD-VERIFY release**: they were written from the task texts while FD-VISIT was not available, and are to be checked against FD-VISIT section 7 first. Their migration list, checks, reverse steps and production checks are in \`docs/FD-VISIT Runbook Addendum.md\` (DEV-071), which is itself a draft until that check is done. Until then, do not run \`supabase db push\` against production with these files present: move them out of the folder or push only up to 0010 (use a branch that does not contain them). The numbers below ("all ten") are for the FD-VERIFY release.`],
])
