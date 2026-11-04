-- DEV-074 (DRAFT correction to 0011): which Doctor's Day Out task is the Optional one.
--
-- 0011 guessed that Advocacy and note-taking is Optional and Pre-visit preparation Required (each
-- bundle has exactly one Optional task, DEV-065, and the guess was marked as one). DEV-074 describes a
-- COMPLETED Doctor's Day Out visit with Advocacy and note-taking Not done with a reason and Pre-visit
-- preparation never logged; a visit can be checked out only with every Required task logged
-- (check_out, 0016), so Pre-visit preparation must be the Optional task and Advocacy and
-- note-taking a Required one. This swaps the two flags.
--
-- Only the checklist changes. A visit already started keeps the flags it was snapshotted with
-- (visit_tasks is never updated), so a visit open when this runs is checked out under the old
-- rules and is not affected. Which task needs a note (note_required) is unchanged. Additive in
-- effect: no visit, entry or booking is touched. Idempotent.

update public.checklist_items set required = false
 where bundle_code = 'doctors_day_out' and name = 'Pre-visit preparation';
update public.checklist_items set required = true
 where bundle_code = 'doctors_day_out' and name = 'Advocacy and note-taking';

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; visits started since keep the flags they were given):
--   update public.checklist_items set required = true
--    where bundle_code = 'doctors_day_out' and name = 'Pre-visit preparation';
--   update public.checklist_items set required = false
--    where bundle_code = 'doctors_day_out' and name = 'Advocacy and note-taking';
-- ---------------------------------------------------------------------------
