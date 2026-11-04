-- DEV-060 (DRAFT, check_in only): the Caregiver checks in to a visit (FD-VISIT §7.3; FR-003,
-- FR-004, FR-009, FR-012; AC-002, AC-003, AC-012). check_out comes with DEV-060's other half.
--
-- SECURITY DEFINER, fixed search_path, role check first. Lock order: the caregiver's profile
-- (FOR SHARE, so a verification being removed at the same moment is serialized with this
-- call) -> the booking (FOR UPDATE) -> the visit. Every time comes from private.visit_now(),
-- never from the caller; the day rule is worked out in Africa/Nairobi.
--
-- Returns {"visit_id": ..., "checked_in_at": ...}, the answer the screen shows the time from.
-- A repeat call by the same Caregiver for a booking already checked in to returns the same
-- answer and writes nothing, so a lost connection and a second tap are safe.
--
-- Errors (the message is the code; SQLSTATE 42501 for NOT_CAREGIVER, P0001 for the rest):
--   NOT_CAREGIVER              the caller is not a Caregiver
--   CAREGIVER_NOT_VERIFIED     the Caregiver is not currently Verified
--   BOOKING_NOT_FOUND          no such booking, or it is not assigned to the caller
--                              (one answer for both, so nothing is learned about others' bookings)
--   BOOKING_NOT_ASSIGNED       the booking is not in `assigned` (cancelled; or finished without a visit)
--   NOT_VISIT_DAY              today (Nairobi) is not the day of the visit, before or after it
--   ANOTHER_VISIT_IN_PROGRESS  the Caregiver has another visit open

create function public.check_in(p_booking_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_status public.booking_status;
  v_bundle public.bundle_code;
  v_when timestamptz;
  v_now timestamptz;
  v_visit public.visits;
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

  select b.status, b.bundle_code, b.requested_datetime
    into v_status, v_bundle, v_when
    from public.bookings b
   where b.id = p_booking_id and b.assigned_caregiver_id = v_me
     for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select * into v_visit from public.visits where booking_id = p_booking_id;
  if found then
    return jsonb_build_object('visit_id', v_visit.id, 'checked_in_at', v_visit.checked_in_at);
  end if;

  if v_status <> 'assigned' then
    raise exception 'BOOKING_NOT_ASSIGNED';
  end if;

  v_now := private.visit_now();
  if (v_now at time zone 'Africa/Nairobi')::date <> (v_when at time zone 'Africa/Nairobi')::date then
    raise exception 'NOT_VISIT_DAY';
  end if;

  perform 1 from public.visits where caregiver_id = v_me and checked_out_at is null;
  if found then
    raise exception 'ANOTHER_VISIT_IN_PROGRESS';
  end if;

  begin
    insert into public.visits (booking_id, caregiver_id, checked_in_at)
    values (p_booking_id, v_me, v_now)
    returning * into v_visit;
  exception when unique_violation then
    -- two check-ins by the same Caregiver at the same moment: the other one won
    raise exception 'ANOTHER_VISIT_IN_PROGRESS';
  end;

  insert into public.visit_tasks (visit_id, checklist_item_id, sort_order, name, required, note_required)
  select v_visit.id, c.id, c.sort_order, c.name, c.required, c.note_required
    from public.checklist_items c
   where c.bundle_code = v_bundle
   order by c.sort_order;

  update public.bookings set status = 'in_progress' where id = p_booking_id;

  return jsonb_build_object('visit_id', v_visit.id, 'checked_in_at', v_visit.checked_in_at);
end;
$$;

revoke all on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; visits already written stay):
--   drop function public.check_in(uuid);
-- ---------------------------------------------------------------------------
