-- DEV-034: caregiver_overview, admin_booking_overview, family_bookings
-- (FD-VERIFY §7.2; BR-008, BR-009, §5.7(s); AC-011, AC-013, AC-019).
--
-- Read-only views for the screens. The two Admin views run with the CALLER's
-- rights (security_invoker), so the Admin-only policies from 0002/0009 already
-- apply, and each also tests for the Admin role itself so a non-Admin gets no
-- rows rather than relying on a single layer.
--
-- family_bookings is different on purpose and is the part the Tech Lead should
-- read first: a family may not read the caregiver's profile (0009), but the
-- booking screen must show the caregiver's name in some states. So this view
-- runs with its OWNER's rights, which bypass row-level security, and the only
-- barrier between one family's bookings and another's is the filter
--     where b.account_id = auth.uid()
-- below. security_barrier makes sure a caller's own filters (for example
-- `?caregiver_name=like.*`) are applied after that filter, never before.
--
-- Rules for the caregiver's name in family_bookings (BR-008, BR-009, §5.7(s)):
--   no caregiver yet                                  -> name null, caregiver_verified null
--   visit started or finished (in_progress/completed) -> the name, whatever their status
--   otherwise (assigned, cancelled)                   -> the name only if the caregiver is
--                                                        currently Verified, else null
-- caregiver_verified is its own column. Nothing else about the caregiver (no id,
-- phone, email) is returned.

-- ---------------------------------------------------------------------------
-- caregiver_overview (Admin): every caregiver with current status and who
-- changed it last. Feeds the Caregivers list and the Caregiver Detail header.
-- ---------------------------------------------------------------------------
create view public.caregiver_overview
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  private.is_verified(p.id) as verified,
  last.created_at as last_changed_at,
  last.acted_by as last_changed_by,
  actor.full_name as last_changed_by_name,
  p.created_at
from public.profiles p
left join lateral (
  select v.created_at, v.acted_by
    from public.caregiver_verifications v
   where v.caregiver_id = p.id
   order by v.created_at desc, v.id desc
   limit 1
) last on true
left join public.profiles actor on actor.id = last.acted_by
where p.role = 'caregiver'
  and public.current_user_role() = 'admin';

-- ---------------------------------------------------------------------------
-- admin_booking_overview (Admin): every booking with the family, the
-- recipient and the assigned caregiver, and whether that caregiver is still
-- Verified. Feeds the Admin booking queue (Requested and Assigned tabs) and the
-- "Bookings that need a new caregiver" panel. Care notes are not included.
-- ---------------------------------------------------------------------------
create view public.admin_booking_overview
with (security_invoker = true) as
select
  b.id,
  b.status,
  b.bundle_code,
  b.requested_datetime,
  b.created_at,
  b.account_id as family_id,
  fam.full_name as family_name,
  fam.phone as family_phone,
  b.care_recipient_id,
  r.name as care_recipient_name,
  b.assigned_caregiver_id as caregiver_id,
  cg.full_name as caregiver_name,
  case when b.assigned_caregiver_id is null then null
       else private.is_verified(b.assigned_caregiver_id) end as caregiver_verified,
  b.assigned_by,
  b.assigned_at
from public.bookings b
join public.profiles fam on fam.id = b.account_id
join public.care_recipients r on r.id = b.care_recipient_id
left join public.profiles cg on cg.id = b.assigned_caregiver_id
where public.current_user_role() = 'admin';

-- ---------------------------------------------------------------------------
-- family_bookings (Family Member): the signed-in family's own bookings. Runs
-- with the owner's rights, see the note at the top.
-- ---------------------------------------------------------------------------
create view public.family_bookings
with (security_barrier = true) as
select
  b.id,
  b.care_recipient_id,
  r.name as care_recipient_name,
  b.bundle_code,
  b.requested_datetime,
  b.status,
  b.created_at,
  b.assigned_at,
  case
    when b.assigned_caregiver_id is null then null
    when b.status in ('in_progress', 'completed') then cg.full_name
    when private.is_verified(b.assigned_caregiver_id) then cg.full_name
    else null
  end as caregiver_name,
  case when b.assigned_caregiver_id is null then null
       else private.is_verified(b.assigned_caregiver_id) end as caregiver_verified
from public.bookings b
join public.care_recipients r on r.id = b.care_recipient_id
left join public.profiles cg on cg.id = b.assigned_caregiver_id
where b.account_id = auth.uid();

-- Signed-in users only. Supabase gives new views to anon and authenticated by
-- default, so take it all back first.
revoke all on public.caregiver_overview from public, anon, authenticated;
revoke all on public.admin_booking_overview from public, anon, authenticated;
revoke all on public.family_bookings from public, anon, authenticated;
grant select on public.caregiver_overview to authenticated;
grant select on public.admin_booking_overview to authenticated;
grant select on public.family_bookings to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand):
--   drop view public.family_bookings;
--   drop view public.admin_booking_overview;
--   drop view public.caregiver_overview;
-- ---------------------------------------------------------------------------
