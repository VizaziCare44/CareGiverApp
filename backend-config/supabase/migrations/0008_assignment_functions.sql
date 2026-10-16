-- DEV-032: assign_booking and change_booking_caregiver (FR-005, FR-007, FR-009,
-- FR-013; AC-004, AC-005, AC-007, AC-008, AC-014, AC-015, AC-016). With
-- migration 0006 in place these are the only way a booking gets a caregiver:
-- clients cannot write bookings, and booking_assignments is closed to them.
-- Do not release the Admin screens that call these before 0006 is applied.
--
-- Each call: Admin check first; the caregiver's profile row is locked "for
-- share" (so a verification being removed at the same moment is serialized
-- with this call, see verify_caregiver / remove_caregiver_verification which
-- lock the same row "for update"); the caregiver must be Verified now; then the
-- booking row is locked and changed only from the expected status; exactly one
-- booking_assignments row is written and its id returned. Lock order is always
-- caregiver first, booking second, so two calls cannot deadlock.
--
-- Errors (the message is the code; SQLSTATE 42501 for NOT_ADMIN, P0001 for the rest):
--   NOT_ADMIN               the caller is not an Admin
--   CAREGIVER_NOT_FOUND     no profile with that id, or it is not a caregiver
--   CAREGIVER_NOT_VERIFIED  the caregiver is not currently Verified
--   BOOKING_NOT_FOUND       no booking with that id
--   BOOKING_NOT_REQUESTED   assign_booking, but the booking is not in `requested`
--   BOOKING_NOT_ASSIGNED    change_booking_caregiver, but the booking is not in
--                           `assigned` (a started or finished visit cannot be
--                           reassigned, AC-008)
--   SAME_CAREGIVER          change_booking_caregiver to the caregiver it already has
-- A retry after a lost connection therefore fails with BOOKING_NOT_REQUESTED /
-- SAME_CAREGIVER and never writes a second assignment.

create function public.assign_booking(p_booking_id uuid, p_caregiver_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_booking uuid;
  v_id uuid;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = p_caregiver_id and role = 'caregiver' for share;
  if not found then
    raise exception 'CAREGIVER_NOT_FOUND';
  end if;

  if not private.is_verified(p_caregiver_id) then
    raise exception 'CAREGIVER_NOT_VERIFIED';
  end if;

  update public.bookings
     set status = 'assigned',
         assigned_caregiver_id = p_caregiver_id,
         assigned_by = auth.uid(),
         assigned_at = now()
   where id = p_booking_id and status = 'requested'
  returning id into v_booking;

  if v_booking is null then
    perform 1 from public.bookings where id = p_booking_id;
    if not found then
      raise exception 'BOOKING_NOT_FOUND';
    end if;
    raise exception 'BOOKING_NOT_REQUESTED';
  end if;

  insert into public.booking_assignments (booking_id, caregiver_id, previous_caregiver_id, assigned_by)
  values (p_booking_id, p_caregiver_id, null, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create function public.change_booking_caregiver(p_booking_id uuid, p_caregiver_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_status public.booking_status;
  v_previous uuid;
  v_id uuid;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = p_caregiver_id and role = 'caregiver' for share;
  if not found then
    raise exception 'CAREGIVER_NOT_FOUND';
  end if;

  if not private.is_verified(p_caregiver_id) then
    raise exception 'CAREGIVER_NOT_VERIFIED';
  end if;

  select status, assigned_caregiver_id into v_status, v_previous
    from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_status <> 'assigned' then
    raise exception 'BOOKING_NOT_ASSIGNED';
  end if;
  if v_previous = p_caregiver_id then
    raise exception 'SAME_CAREGIVER';
  end if;

  update public.bookings
     set assigned_caregiver_id = p_caregiver_id,
         assigned_by = auth.uid(),
         assigned_at = now()
   where id = p_booking_id and status = 'assigned';

  insert into public.booking_assignments (booking_id, caregiver_id, previous_caregiver_id, assigned_by)
  values (p_booking_id, p_caregiver_id, v_previous, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- Same rights as the verification functions: signed-in users only (Supabase
-- grants new public functions to anon by default, see 0004).
revoke all on function public.assign_booking(uuid, uuid) from public, anon;
revoke all on function public.change_booking_caregiver(uuid, uuid) from public, anon;
grant execute on function public.assign_booking(uuid, uuid) to authenticated;
grant execute on function public.change_booking_caregiver(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; bookings and assignment rows already written stay):
--   drop function public.change_booking_caregiver(uuid, uuid);
--   drop function public.assign_booking(uuid, uuid);
-- ---------------------------------------------------------------------------
