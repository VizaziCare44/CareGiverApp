-- The release checks of docs/Production Release Runbook.md (DEV-052), run here on
-- a database that has every migration. The runbook tells the Tech Lead to run
-- these same queries on the production project after the migrations are applied;
-- running them in CI first proves each query is correct and returns the stated
-- result, so a wrong answer on production means production differs, not the query.
-- Each check is stable: it stays true after the migrations that come later.
-- Run with `supabase test db`. If you change a query here, change it in the runbook.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- ---------------------------------------------------------------------------
-- 0001 init (profiles, care_recipients, bookings, the sign-up trigger)
-- ---------------------------------------------------------------------------
select is((select count(*) from information_schema.tables
            where table_schema = 'public' and table_name in ('profiles', 'care_recipients', 'bookings')),
  3::bigint, '0001: the three tables exist');
select is((select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
            where n.nspname = 'public' and t.typname in ('user_role', 'bundle_code', 'booking_status')),
  3::bigint, '0001: the three enums exist');
select is((select count(*) from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal),
  1::bigint, '0001: the sign-up trigger exists');

-- ---------------------------------------------------------------------------
-- 0002 row-level security
-- ---------------------------------------------------------------------------
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname in ('profiles', 'care_recipients', 'bookings') and c.relrowsecurity),
  3::bigint, '0002: row-level security is on for all three tables');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'current_user_role'),
  1::bigint, '0002: the role helper exists');

-- ---------------------------------------------------------------------------
-- 0003 and 0004 function exposure
-- ---------------------------------------------------------------------------
select is(has_function_privilege('anon', 'public.handle_new_user()', 'execute'), false,
  '0003/0004: anon cannot call handle_new_user');
select is(has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), false,
  '0003/0004: signed-in users cannot call handle_new_user');
select is(has_function_privilege('anon', 'public.current_user_role()', 'execute'), false,
  '0003/0004: anon cannot call current_user_role');
select is(has_function_privilege('authenticated', 'public.current_user_role()', 'execute'), true,
  '0003/0004: signed-in users can (the policies need it)');

-- ---------------------------------------------------------------------------
-- 0005 verification schema and role hardening
-- ---------------------------------------------------------------------------
select is((select count(*) from information_schema.tables
            where table_schema = 'public' and table_name in ('caregiver_verifications', 'booking_assignments')),
  2::bigint, '0005: the two history tables exist');
select is((select count(*) from information_schema.columns
            where table_schema = 'public' and table_name = 'bookings' and column_name in ('assigned_by', 'assigned_at')),
  2::bigint, '0005: bookings has assigned_by and assigned_at');
select is((select count(*) from pg_constraint where conname = 'bookings_status_caregiver_check'),
  1::bigint, '0005: the status/caregiver rule exists');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'private' and p.proname = 'is_verified'),
  1::bigint, '0005: private.is_verified exists');
select is((select count(*) from pg_trigger where tgname = 'on_auth_user_app_metadata_changed' and not tgisinternal),
  1::bigint, '0005: the role-from-app-metadata trigger exists');
select is((select count(*) from pg_trigger
            where tgname in ('caregiver_verifications_append_only', 'booking_assignments_append_only') and not tgisinternal),
  2::bigint, '0005: both history tables are append-only');
select ok(pg_get_functiondef('public.handle_new_user()'::regprocedure) like '%raw_app_meta_data%'
      and pg_get_functiondef('public.handle_new_user()'::regprocedure) not like '%raw_user_meta_data ->> ''role''%',
  '0005: the role comes from app metadata, never from what the browser sends');
select ok(not has_table_privilege('anon', 'public.caregiver_verifications', 'select')
      and not has_table_privilege('authenticated', 'public.caregiver_verifications', 'insert')
      and not has_table_privilege('authenticated', 'public.booking_assignments', 'insert'),
  '0005: nobody can write the history tables through the API');

-- ---------------------------------------------------------------------------
-- 0006 bookings write path (DEV-030, has a reverse step)
-- ---------------------------------------------------------------------------
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'bookings'
            and policyname in ('bookings: family read own', 'bookings: family insert own')),
  2::bigint, '0006: the two family policies exist');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'bookings'
            and policyname = 'bookings: family CRUD own'),
  0::bigint, '0006: the old open policy is gone');
select ok(has_table_privilege('authenticated', 'public.bookings', 'select')
      and not has_table_privilege('authenticated', 'public.bookings', 'update')
      and not has_table_privilege('authenticated', 'public.bookings', 'delete'),
  '0006: a signed-in user can read bookings but not change or delete them');
select ok(has_column_privilege('authenticated', 'public.bookings', 'account_id', 'insert')
      and not has_column_privilege('authenticated', 'public.bookings', 'status', 'insert')
      and not has_column_privilege('authenticated', 'public.bookings', 'assigned_caregiver_id', 'insert'),
  '0006: a booking can be created with four columns, not with a status or a caregiver');

-- ---------------------------------------------------------------------------
-- 0007 verification functions and 0008 assignment functions
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'public.verify_caregiver(uuid, text)', 'execute')
      and has_function_privilege('authenticated', 'public.remove_caregiver_verification(uuid, text)', 'execute')
      and not has_function_privilege('anon', 'public.verify_caregiver(uuid, text)', 'execute')
      and not has_function_privilege('anon', 'public.remove_caregiver_verification(uuid, text)', 'execute'),
  '0007: the verification functions exist, for signed-in users only');
select ok(has_function_privilege('authenticated', 'public.assign_booking(uuid, uuid)', 'execute')
      and has_function_privilege('authenticated', 'public.change_booking_caregiver(uuid, uuid)', 'execute')
      and not has_function_privilege('anon', 'public.assign_booking(uuid, uuid)', 'execute')
      and not has_function_privilege('anon', 'public.change_booking_caregiver(uuid, uuid)', 'execute'),
  '0008: the assignment functions exist, for signed-in users only');

-- ---------------------------------------------------------------------------
-- 0009 caregiver and family reads
-- ---------------------------------------------------------------------------
select is(has_table_privilege('authenticated', 'public.profiles', 'update'), false,
  '0009: nobody can change a profile through the API');
select is((select count(*) from pg_policies where schemaname = 'public'
            and policyname in ('bookings: caregiver read assigned', 'care_recipients: caregiver read assigned',
                               'caregiver_verifications: admin read', 'booking_assignments: admin read')),
  4::bigint, '0009: the four read policies exist');
select is(has_table_privilege('anon', 'public.care_recipients', 'select'), false,
  '0009: a signed-out request cannot read care recipients');

-- ---------------------------------------------------------------------------
-- 0010 views
-- ---------------------------------------------------------------------------
select is((select count(*) from information_schema.views
            where table_schema = 'public' and table_name in ('caregiver_overview', 'admin_booking_overview', 'family_bookings')),
  3::bigint, '0010: the three views exist');
select ok(has_table_privilege('authenticated', 'public.family_bookings', 'select')
      and not has_table_privilege('anon', 'public.family_bookings', 'select')
      and not has_table_privilege('anon', 'public.caregiver_overview', 'select')
      and not has_table_privilege('anon', 'public.admin_booking_overview', 'select'),
  '0010: the views are for signed-in users only');
select is((select count(*) from information_schema.columns
            where table_schema = 'public' and table_name = 'family_bookings'
              and column_name in ('assigned_caregiver_id', 'caregiver_id', 'phone', 'email')),
  0::bigint, '0010: a family''s booking view carries no caregiver id, phone or email');

-- ---------------------------------------------------------------------------
-- The whole database
-- ---------------------------------------------------------------------------
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint, 'every table in the public schema has row-level security on');

select * from finish();
rollback;
