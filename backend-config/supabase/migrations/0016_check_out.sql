-- DEV-060 second half (DRAFT): check_out, the Caregiver ends the visit (FD-VISIT §7.3; FR-008,
-- FR-010, FR-015; AC-010). Written without FD-VISIT, for DEV-067's confirmation and summary.
--
-- SECURITY DEFINER, fixed search_path, role check first. Lock order, as in check_in: the
-- caregiver's profile (FOR SHARE) -> the booking (FOR UPDATE) -> the visit (FOR UPDATE). The time
-- is private.visit_now(), never the caller's. A visit can be checked out only when every
-- Required task has an outcome (Done, or Not done with its reason); an Optional task with none
-- simply stays "Not recorded". Checking out closes the visit (it never changes again, see the
-- triggers in 0011) and moves the booking to `completed`.
--
-- A repeat call for a visit already checked out by the same Caregiver changes nothing and
-- returns the same answer, so a second tap or a retry after a lost connection is safe.
--
-- The note about the visit is optional, trimmed, and limited to 2,000 characters (DRAFT: the
-- limit is a guess like the other notes; 0011 had 1,000, changed here).
--
-- Returns {"visit_id", "checked_out_at", "changed"}.
--
-- Errors (the message is the code; SQLSTATE 42501 for NOT_CAREGIVER, P0001 for the rest):
--   NOT_CAREGIVER            the caller is not a Caregiver
--   CAREGIVER_NOT_VERIFIED   the Caregiver is not currently Verified
--   BOOKING_NOT_FOUND        no such booking, or it is not assigned to the caller
--   VISIT_NOT_FOUND          the booking has no visit (never checked in to)
--   REQUIRED_TASKS_MISSING   a Required task has no outcome
--   VISIT_NOTE_TOO_LONG      more than 2,000 characters

alter table public.visits drop constraint visits_visit_note_check;
alter table public.visits
  add constraint visits_visit_note_check check (visit_note is null or char_length(btrim(visit_note)) between 1 and 2000);

create function public.check_out(p_booking_id uuid, p_visit_note text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_visit_note, ''), E' \t\r\n'), '');
  v_visit public.visits;
  v_now timestamptz;
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

  perform 1 from public.bookings where id = p_booking_id and assigned_caregiver_id = v_me for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select * into v_visit from public.visits where booking_id = p_booking_id for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND';
  end if;

  if v_visit.checked_out_at is not null then
    return jsonb_build_object('visit_id', v_visit.id, 'checked_out_at', v_visit.checked_out_at, 'changed', false);
  end if;

  if char_length(v_note) > 2000 then
    raise exception 'VISIT_NOTE_TOO_LONG';
  end if;

  perform 1
    from public.visit_tasks t
    left join private.visit_task_latest l on l.visit_task_id = t.id
   where t.visit_id = v_visit.id and t.required and l.outcome is null;
  if found then
    raise exception 'REQUIRED_TASKS_MISSING';
  end if;

  v_now := private.visit_now();

  update public.visits set checked_out_at = v_now, visit_note = v_note where id = v_visit.id;
  update public.bookings set status = 'completed' where id = p_booking_id;

  return jsonb_build_object('visit_id', v_visit.id, 'checked_out_at', v_now, 'changed', true);
end;
$$;

revoke all on function public.check_out(uuid, text) from public, anon;
grant execute on function public.check_out(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; visits already checked out stay):
--   drop function public.check_out(uuid, text);
--   alter table public.visits drop constraint visits_visit_note_check;
--   alter table public.visits
--     add constraint visits_visit_note_check check (visit_note is null or char_length(btrim(visit_note)) between 1 and 1000);
--   (only while no visit note longer than 1,000 characters exists)
-- ---------------------------------------------------------------------------
