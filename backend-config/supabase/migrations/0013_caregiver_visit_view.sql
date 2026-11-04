-- DEV-062 (DRAFT, the part the Assignment Detail screen needs): what a Caregiver may read
-- about visits (FD-VISIT §7.2, §7.4; BR-006; AC-013, AC-014, AC-016).
--
-- checklist_items: Caregivers and Admins read it (the screen lists a bundle's tasks before
-- check-in). Nobody else; anon nothing.
--
-- caregiver_visit: one row per booking assigned to the signed-in Caregiver (assigned,
-- in progress or completed), only while that Caregiver is currently Verified, so a removed
-- Caregiver gets no rows. Like family_bookings it runs with its OWNER's rights, and the
-- only barrier is the filter on auth.uid() below (security_barrier keeps a caller's own
-- filters behind it). It tells the screen which state to draw, never the device clock:
--   day_state   'before' | 'today' | 'passed': today's date in Africa/Nairobi, taken from
--               private.visit_now(), against the date of the visit in Africa/Nairobi
--   visit_id, checked_in_at, checked_out_at, visit_note   the visit, null until checked in
--   other_*     another visit of the same Caregiver that is still open (its booking, the
--               recipient's name and the bundle), for "you already have a visit in progress"

create policy "checklist_items: caregivers and admins read" on public.checklist_items
  for select to authenticated
  using (public.current_user_role() in ('caregiver', 'admin'));

grant select on public.checklist_items to authenticated;

-- Where today stands against the day of a visit, in Africa/Nairobi, by the visit clock. It takes
-- the visit's time as an argument on purpose: a function with no arguments would be worked out
-- once while the query is planned, with the CALLER's rights, and a Caregiver may not run
-- private.visit_now(). With an argument it runs per row, as its owner, like check_in.
create function private.visit_day_state(p_visit_at timestamptz)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select case
    when (private.visit_now() at time zone 'Africa/Nairobi')::date < (p_visit_at at time zone 'Africa/Nairobi')::date then 'before'
    when (private.visit_now() at time zone 'Africa/Nairobi')::date > (p_visit_at at time zone 'Africa/Nairobi')::date then 'passed'
    else 'today'
  end;
$$;

revoke all on function private.visit_day_state(timestamptz) from public, anon, authenticated;

create view public.caregiver_visit
with (security_barrier = true) as
select
  b.id as booking_id,
  b.status,
  private.visit_day_state(b.requested_datetime) as day_state,
  v.id as visit_id,
  v.checked_in_at,
  v.checked_out_at,
  v.visit_note,
  o.booking_id as other_booking_id,
  o.recipient_name as other_recipient_name,
  o.bundle_code as other_bundle_code
from public.bookings b
left join public.visits v on v.booking_id = b.id
left join lateral (
  select ov.booking_id, r.name as recipient_name, ob.bundle_code
    from public.visits ov
    join public.bookings ob on ob.id = ov.booking_id
    join public.care_recipients r on r.id = ob.care_recipient_id
   where ov.caregiver_id = auth.uid()
     and ov.checked_out_at is null
     and ov.booking_id <> b.id
   limit 1
) o on true
where b.assigned_caregiver_id = auth.uid()
  and b.status in ('assigned', 'in_progress', 'completed')
  and private.is_verified(auth.uid());

revoke all on public.caregiver_visit from public, anon, authenticated;
grant select on public.caregiver_visit to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand):
--   drop view public.caregiver_visit;
--   drop function private.visit_day_state(timestamptz);
--   drop policy "checklist_items: caregivers and admins read" on public.checklist_items;
--   revoke select on public.checklist_items from authenticated;
-- ---------------------------------------------------------------------------
