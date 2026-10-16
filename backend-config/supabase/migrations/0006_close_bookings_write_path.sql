-- DEV-030: close the bookings write path (FR-005, BR-001, BR-005, BR-009,
-- BR-013; AC-020; DEV-028 finding on "bookings: family CRUD own"). Review this
-- migration first, and apply it before DEV-032's functions are used: the
-- assignment functions assume a client cannot touch bookings on its own.
--
-- Before: a Family Member could update or delete their bookings, and insert
-- one with any status, caregiver, assignment fields or created_at, for any
-- care recipient. After: read own, insert own with four columns for their own
-- recipient, and nothing else through the API for any role. Admin keeps read
-- all. Assignment, status changes and cancellation only happen in the
-- SECURITY DEFINER functions (DEV-031/032 and later), which run as the owner.

drop policy "bookings: family CRUD own" on public.bookings;

-- Rights are what actually limit the columns: a column that is not granted
-- cannot be sent at all, even with its default value (status, caregiver,
-- assigned_by, assigned_at, created_at, id).
revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
grant insert (account_id, care_recipient_id, bundle_code, requested_datetime)
  on public.bookings to authenticated;

create policy "bookings: family read own" on public.bookings
  for select
  using (account_id = auth.uid());

-- The recipient must belong to the same family. The subquery runs with the
-- caller's own rights, so it only sees recipients they own (care_recipients
-- policy "family CRUD own").
create policy "bookings: family insert own" on public.bookings
  for insert
  with check (
    account_id = auth.uid()
    and exists (
      select 1 from public.care_recipients r
       where r.id = care_recipient_id
         and r.account_id = auth.uid()
    )
  );

-- "bookings: admin read all" from 0002 is unchanged.

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; re-opens the hole that DEV-028 found):
--   drop policy "bookings: family insert own" on public.bookings;
--   drop policy "bookings: family read own" on public.bookings;
--   grant all on public.bookings to authenticated;
--   create policy "bookings: family CRUD own" on public.bookings
--     for all
--     using (account_id = auth.uid())
--     with check (account_id = auth.uid());
-- (anon had default table rights before; no policy ever let it read or write.)
-- ---------------------------------------------------------------------------
