-- DEV-070 (DRAFT): the test clock belongs to one Caregiver (FD-VISIT §12 helper
-- setClock(caregiver, instant)). In 0011 the clock was one row for the whole database, so a
-- test that set it would change "now" for every test running beside it. Now a row names the
-- Caregiver it is for, and private.visit_now() returns that moment only for that Caregiver's
-- own calls; everyone else, and every call with no signed-in user, still gets the real time.
--
-- Still zero rows in production, and still closed to the API roles: only a direct database
-- connection (the tests' setClock, local stack only) can write a row. The table is empty
-- everywhere it exists (nothing has ever written to it), so it is replaced rather than
-- altered. Additive in effect: no visit, entry or booking is touched.

drop table private.test_clock;

create table private.test_clock (
  caregiver_id uuid primary key references public.profiles (id),
  at timestamptz not null
);

revoke all on private.test_clock from public, anon, authenticated;

create or replace function private.visit_now()
returns timestamptz
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select c.at from private.test_clock c where c.caregiver_id = auth.uid()),
    clock_timestamp()
  );
$$;

revoke all on function private.visit_now() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand): restore the single-row clock of migration 0011:
--   drop table private.test_clock;
--   create table private.test_clock (only_row boolean primary key default true check (only_row), at timestamptz not null);
--   revoke all on private.test_clock from public, anon, authenticated;
--   create or replace function private.visit_now() returns timestamptz language sql stable security definer
--     set search_path = '' as $f$ select coalesce((select at from private.test_clock), clock_timestamp()); $f$;
-- ---------------------------------------------------------------------------
