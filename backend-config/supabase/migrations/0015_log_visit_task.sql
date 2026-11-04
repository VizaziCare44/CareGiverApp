-- DEV-061 (DRAFT) with the corrections DEV-066 needs: log_visit_task, the Caregiver logs or
-- changes a task (FD-VISIT §7.3; FR-005 to FR-007, FR-013; AC-005 to AC-008, AC-011). Written
-- without FD-VISIT; DEV-066's text gave two corrections to the draft schema, made first:
--   1. the limits are 2,000 characters for a note and 500 for a reason (§7.8(d), (e)); 0011
--      had 1,000 for both
--   2. the Doctor's Day Out task is "Post-visit summary" (0011 seeded "Post-visit report",
--      which is the name of the bundle's inclusion on the booking card, not of the task)
-- Both are made by this new migration, not by editing 0011, which is already applied.
-- Nothing has been recorded against the old name or limit (no visit exists on dev).
--
-- log_visit_task(task, outcome, note, reason): SECURITY DEFINER, fixed search_path, role check
-- first. Lock order: the caregiver's profile (FOR SHARE) -> the visit (FOR UPDATE). Rules:
--   Done      a note, required when the task needs one (note_required); no reason
--   Not done  a reason, always required; no note
-- Text is trimmed; an empty text counts as none. The time of the entry is private.visit_now().
-- Entries are only added, never changed: a change is a new entry, and the one with the highest
-- id counts (private.visit_task_latest). Sending exactly what the entry that counts already
-- says writes nothing and returns that entry, so a retry after a lost connection is safe.
--
-- Returns {"entry_id", "outcome", "logged_at", "changed"}.
--
-- Errors (the message is the code; SQLSTATE 42501 for NOT_CAREGIVER, P0001 for the rest):
--   NOT_CAREGIVER            the caller is not a Caregiver
--   CAREGIVER_NOT_VERIFIED   the Caregiver is not currently Verified
--   TASK_NOT_FOUND           no such task, or it is not on one of the caller's visits
--   VISIT_CLOSED             the visit has been checked out
--   INVALID_OUTCOME          the outcome is not 'done' or 'not_done'
--   NOTE_REQUIRED            Done on a task that needs a note, with no note
--   REASON_REQUIRED          Not done with no reason
--   NOTE_TOO_LONG            more than 2,000 characters
--   REASON_TOO_LONG          more than 500 characters

update public.checklist_items
   set name = 'Post-visit summary'
 where bundle_code = 'doctors_day_out' and name = 'Post-visit report';

alter table public.visit_task_entries
  drop constraint visit_task_entries_note_check,
  drop constraint visit_task_entries_reason_check;

alter table public.visit_task_entries
  add constraint visit_task_entries_note_check check (note is null or char_length(btrim(note)) between 1 and 2000),
  add constraint visit_task_entries_reason_check check (reason is null or char_length(btrim(reason)) between 1 and 500);

create function public.log_visit_task(
  p_task_id uuid,
  p_outcome text,
  p_note text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_visit_id uuid;
  v_closed timestamptz;
  v_note_required boolean;
  v_outcome public.visit_outcome;
  v_note text := nullif(btrim(coalesce(p_note, ''), E' \t\r\n'), '');
  v_reason text := nullif(btrim(coalesce(p_reason, ''), E' \t\r\n'), '');
  v_last public.visit_task_entries;
  v_entry public.visit_task_entries;
begin
  if public.current_user_role() is distinct from 'caregiver' then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_me and role = 'caregiver' for share;
  if not found then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  if not private.is_verified(v_me) then
    raise exception 'CAREGIVER_NOT_VERIFIED';
  end if;

  select t.visit_id, t.note_required
    into v_visit_id, v_note_required
    from public.visit_tasks t
    join public.visits v on v.id = t.visit_id
   where t.id = p_task_id and v.caregiver_id = v_me;
  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  select checked_out_at into v_closed from public.visits where id = v_visit_id for update;
  if v_closed is not null then
    raise exception 'VISIT_CLOSED';
  end if;

  if p_outcome is null or p_outcome not in ('done', 'not_done') then
    raise exception 'INVALID_OUTCOME';
  end if;
  v_outcome := p_outcome::public.visit_outcome;

  if v_outcome = 'done' then
    v_reason := null;
    if v_note_required and v_note is null then
      raise exception 'NOTE_REQUIRED';
    end if;
  else
    v_note := null;
    if v_reason is null then
      raise exception 'REASON_REQUIRED';
    end if;
  end if;

  if char_length(v_note) > 2000 then
    raise exception 'NOTE_TOO_LONG';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG';
  end if;

  select * into v_last
    from public.visit_task_entries
   where visit_task_id = p_task_id
   order by id desc
   limit 1;
  if found
     and v_last.outcome = v_outcome
     and v_last.note is not distinct from v_note
     and v_last.reason is not distinct from v_reason then
    return jsonb_build_object('entry_id', v_last.id, 'outcome', v_last.outcome, 'logged_at', v_last.logged_at, 'changed', false);
  end if;

  insert into public.visit_task_entries (visit_task_id, outcome, note, reason, logged_at)
  values (p_task_id, v_outcome, v_note, v_reason, private.visit_now())
  returning * into v_entry;

  return jsonb_build_object('entry_id', v_entry.id, 'outcome', v_entry.outcome, 'logged_at', v_entry.logged_at, 'changed', true);
end;
$$;

revoke all on function public.log_visit_task(uuid, text, text, text) from public, anon;
grant execute on function public.log_visit_task(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; entries already written stay):
--   drop function public.log_visit_task(uuid, text, text, text);
--   alter table public.visit_task_entries
--     drop constraint visit_task_entries_note_check, drop constraint visit_task_entries_reason_check;
--   alter table public.visit_task_entries
--     add constraint visit_task_entries_note_check check (note is null or char_length(btrim(note)) between 1 and 1000),
--     add constraint visit_task_entries_reason_check check (reason is null or char_length(btrim(reason)) between 1 and 1000);
--   update public.checklist_items set name = 'Post-visit report'
--    where bundle_code = 'doctors_day_out' and name = 'Post-visit summary';
--   (only while no entry longer than the old limits exists)
-- ---------------------------------------------------------------------------
