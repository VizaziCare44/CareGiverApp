-- Tests for migration 0005 (DEV-029 + role hardening). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Fixtures: a1 tries to claim admin through user metadata, a2 is provisioned
-- as a caregiver through app metadata, a3 is an ordinary family member, a4 is
-- a provisioned admin.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'meta-admin@t.test', '{"role":"admin","full_name":"Meta Admin"}', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'caregiver@t.test', '{"full_name":"Care Giver"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'family@t.test', '{"full_name":"Fam Member"}', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'admin@t.test', '{"full_name":"Real Admin"}', '{"role":"admin"}');

-- 1-4: where the role comes from
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'family_member', 'sign-up metadata cannot set the role');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  'caregiver', 'app metadata (service role only) sets the role');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'family_member', 'no role given defaults to family_member');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a4'),
  'admin', 'a provisioned admin gets admin');

-- The admin API writes app_metadata after the insert; a change there applies
-- the role, a change to user metadata never does.
update auth.users set raw_user_meta_data = '{"role":"admin","full_name":"Meta Admin"}'
 where id = '00000000-0000-0000-0000-0000000000a3';
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'family_member', 'changing user metadata later does not change the role');

update auth.users set raw_app_meta_data = '{"role":"caregiver"}'
 where id = '00000000-0000-0000-0000-0000000000a1';
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'caregiver', 'changing app metadata later applies the role');

-- 7-11: a signed-in family member
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501', null, 'a user cannot change their own role');
-- 0009 (DEV-033) removed the name/phone update: no API write on profiles at all.
select throws_ok(
  $$update public.profiles set full_name = 'Fam Renamed' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501', null, 'a user cannot change their own name either (no API write on profiles)');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'Fam Member', 'the name is unchanged');
-- 0009 grants Admin read only: other signed-in users get no rows.
select is((select count(*)::int from public.caregiver_verifications), 0,
  'a signed-in non-Admin sees no caregiver_verifications');
select is((select count(*)::int from public.booking_assignments), 0,
  'a signed-in non-Admin sees no booking_assignments');

reset role;

-- 10-14: append-only caregiver_verifications (the trigger stops everyone,
-- including the roles that bypass grants and RLS)
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000a2', 'verified', 'Met in person, checked references',
        '00000000-0000-0000-0000-0000000000a4');

select throws_ok($$update public.caregiver_verifications set note = 'edited'$$,
  'P0001', 'caregiver_verifications is append-only: UPDATE is not allowed', 'verification rows cannot be updated');
select throws_ok($$delete from public.caregiver_verifications$$,
  'P0001', 'caregiver_verifications is append-only: DELETE is not allowed', 'verification rows cannot be deleted');
select throws_ok($$truncate public.caregiver_verifications$$,
  'P0001', 'caregiver_verifications is append-only: TRUNCATE is not allowed', 'verification history cannot be truncated');
select throws_ok(
  $$insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
    values ('00000000-0000-0000-0000-0000000000a2', 'verified', '   ', '00000000-0000-0000-0000-0000000000a4')$$,
  '23514', null, 'a blank note is rejected');
select is((select count(*)::int from information_schema.columns
            where table_schema = 'public'
              and table_name in ('caregiver_verifications', 'booking_assignments')
              and column_name ~* '(id_number|id_image|background|document|passport)'),
  0, 'no column for ID numbers, ID images or background checks (AC-017)');

-- 15-17: bookings status/caregiver rule
insert into public.care_recipients (id, account_id, name)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a3', 'Mzee Test');

select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime, status)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 'medicheck', now(), 'assigned')$$,
  '23514', null, 'assigned without a caregiver is rejected');
select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime, status, assigned_caregiver_id)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 'medicheck', now(), 'requested',
            '00000000-0000-0000-0000-0000000000a2')$$,
  '23514', null, 'requested with a caregiver is rejected');
select lives_ok(
  $$insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                                 assigned_caregiver_id, assigned_by, assigned_at)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3',
            '00000000-0000-0000-0000-0000000000c1', 'medicheck', now(), 'assigned',
            '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a4', now())$$,
  'a fully assigned booking is accepted');

-- 18-20: append-only booking_assignments
insert into public.booking_assignments (booking_id, caregiver_id, assigned_by)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2',
        '00000000-0000-0000-0000-0000000000a4');

select throws_ok($$update public.booking_assignments set caregiver_id = caregiver_id$$,
  'P0001', 'booking_assignments is append-only: UPDATE is not allowed', 'assignment rows cannot be updated');
select throws_ok($$delete from public.booking_assignments$$,
  'P0001', 'booking_assignments is append-only: DELETE is not allowed', 'assignment rows cannot be deleted');
select throws_ok($$truncate public.booking_assignments$$,
  'P0001', 'booking_assignments is append-only: TRUNCATE is not allowed', 'assignment history cannot be truncated');

-- 21-24: private.is_verified follows the latest history row
select is(private.is_verified('00000000-0000-0000-0000-0000000000a3'), false, 'no history means not verified');
select is(private.is_verified('00000000-0000-0000-0000-0000000000a2'), true, 'latest row verified means verified');

insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000a2', 'removed', 'Reference check failed',
        '00000000-0000-0000-0000-0000000000a4');
select is(private.is_verified('00000000-0000-0000-0000-0000000000a2'), false, 'a later removal means not verified');

insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000a2', 'verified', 'Re-checked, cleared',
        '00000000-0000-0000-0000-0000000000a4');
select is(private.is_verified('00000000-0000-0000-0000-0000000000a2'), true, 'marked verified again means verified');

-- 25-26: the private schema is not reachable by anonymous users
select is(has_schema_privilege('anon', 'private', 'usage'), false, 'anon cannot use the private schema');
select is(has_function_privilege('anon', 'private.is_verified(uuid)', 'execute'), false,
  'anon cannot run is_verified');

select * from finish();
rollback;
