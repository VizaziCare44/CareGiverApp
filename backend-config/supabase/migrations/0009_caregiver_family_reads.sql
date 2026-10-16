-- DEV-033: RLS and grants for caregiver and family reads (FD-VERIFY §7.4;
-- BR-007; AC-007, AC-010, AC-013, AC-018, AC-021). Completes the Caregiver
-- placeholder left in 0002.
--
-- After this migration, through the API:
--   Caregiver : reads the bookings assigned to them, and the care recipients
--               (care notes included) of those bookings, only while the booking
--               is assigned to them AND they are currently Verified. Remove the
--               verification and both disappear at once; mark them Verified
--               again while still assigned and they come back. Cancelled
--               bookings are not shown. Own profile only.
--   Family    : own profile, own recipients, own bookings (unchanged).
--   Admin     : everything above plus the verification and assignment history.
--   Nobody    : can write to profiles. (0005 still let a user change their own
--               name and phone; nothing in the app does, so that is removed.)

-- ---------------------------------------------------------------------------
-- 1. profiles: read only
-- ---------------------------------------------------------------------------

revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
drop policy "profiles: self update" on public.profiles;

-- ---------------------------------------------------------------------------
-- 2. Admin read of the history tables (0005 closed them to every client)
-- ---------------------------------------------------------------------------

grant select on public.caregiver_verifications, public.booking_assignments to authenticated;

create policy "caregiver_verifications: admin read" on public.caregiver_verifications
  for select using (public.current_user_role() = 'admin');

create policy "booking_assignments: admin read" on public.booking_assignments
  for select using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 3. Caregiver read of assigned bookings and their recipients
-- ---------------------------------------------------------------------------

-- The recipient check goes through a SECURITY DEFINER helper so the policy on
-- care_recipients does not re-enter the policies on bookings (and so the two
-- tables can never form a policy loop).
create function private.caregiver_sees_recipient(p_recipient uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select private.is_verified(auth.uid())
     and exists (
       select 1
         from public.bookings b
        where b.care_recipient_id = p_recipient
          and b.assigned_caregiver_id = auth.uid()
          and b.status in ('assigned', 'in_progress', 'completed')
     );
$$;

revoke all on function private.caregiver_sees_recipient(uuid) from public, anon;
grant execute on function private.caregiver_sees_recipient(uuid) to authenticated;

-- Anonymous users have no use for care_recipients (profiles, bookings and the
-- history tables were already closed to them in 0005/0006). Without this a
-- request with no session reaches the policies and errors on a function it
-- may not run, instead of being refused up front.
revoke all on public.care_recipients from anon;

create policy "bookings: caregiver read assigned" on public.bookings
  for select
  to authenticated
  using (
    assigned_caregiver_id = auth.uid()
    and status in ('assigned', 'in_progress', 'completed')
    and private.is_verified(auth.uid())
  );

create policy "care_recipients: caregiver read assigned" on public.care_recipients
  for select
  to authenticated
  using (private.caregiver_sees_recipient(id));

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand):
--   drop policy "care_recipients: caregiver read assigned" on public.care_recipients;
--   drop policy "bookings: caregiver read assigned" on public.bookings;
--   drop function private.caregiver_sees_recipient(uuid);
--   grant all on public.care_recipients to anon;   -- (default rights; no policy ever matched anon)
--   drop policy "booking_assignments: admin read" on public.booking_assignments;
--   drop policy "caregiver_verifications: admin read" on public.caregiver_verifications;
--   revoke select on public.caregiver_verifications, public.booking_assignments from authenticated;
--   grant update (full_name, phone) on public.profiles to authenticated;
--   create policy "profiles: self update" on public.profiles
--     for update using (id = auth.uid()) with check (id = auth.uid());
-- ---------------------------------------------------------------------------
