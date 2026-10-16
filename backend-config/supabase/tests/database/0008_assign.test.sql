-- Tests for migration 0008 (DEV-032, assign_booking / change_booking_caregiver).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ad = Admin; c1, c2 verified caregivers; c3 an unverified caregiver; fm a family member.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@t.test', '{"full_name":"Caregiver Three"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'fm@t.test', '{"full_name":"Family"}', '{}');

insert into public.caregiver_verifications (caregiver_id, action, note, acted_by) values
  ('00000000-0000-0000-0000-0000000000c1', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000000c2', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad');

insert into public.care_recipients (id, account_id, name)
values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Mzee Test');

-- b1, b2 requested; b3 cancelled; b4 already in progress with c1.
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status) values
  ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '1 day', 'requested'),
  ('00000000-0000-0000-0000-00000000b0b2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '2 days', 'requested'),
  ('00000000-0000-0000-0000-00000000b0b3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '3 days', 'cancelled');
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at)
values ('00000000-0000-0000-0000-00000000b0b4', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
        'medicheck', now() + interval '4 days', 'in_progress',
        '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());

set local role authenticated;

-- Not an Admin ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1')$$,
  '42501', 'NOT_ADMIN', 'a family member cannot assign');
select throws_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000b0b4', '00000000-0000-0000-0000-0000000000c2')$$,
  '42501', 'NOT_ADMIN', 'a family member cannot change the caregiver');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1')$$,
  '42501', 'NOT_ADMIN', 'a caregiver cannot assign themselves');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1')$$,
  '42501', 'NOT_ADMIN', 'a call with no signed-in user is refused');

select is(has_function_privilege('anon', 'public.assign_booking(uuid, uuid)', 'execute'), false, 'anon cannot run assign_booking');
select is(has_function_privilege('anon', 'public.change_booking_caregiver(uuid, uuid)', 'execute'), false, 'anon cannot run change_booking_caregiver');
select is(has_function_privilege('authenticated', 'public.assign_booking(uuid, uuid)', 'execute'), true, 'signed-in users can run assign_booking');
select is(has_function_privilege('authenticated', 'public.change_booking_caregiver(uuid, uuid)', 'execute'), true, 'signed-in users can run change_booking_caregiver');

-- Admin ------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-00000000dead')$$,
  'P0001', 'CAREGIVER_NOT_FOUND', 'an unknown caregiver is refused');
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000f1')$$,
  'P0001', 'CAREGIVER_NOT_FOUND', 'a family member cannot be assigned');
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c3')$$,
  'P0001', 'CAREGIVER_NOT_VERIFIED', 'an unverified caregiver is refused');
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000dead', '00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'BOOKING_NOT_FOUND', 'an unknown booking is refused');
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b3', '00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'BOOKING_NOT_REQUESTED', 'a cancelled booking cannot be assigned');

select lives_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1')$$,
  'an Admin can assign a requested booking to a verified caregiver');
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'BOOKING_NOT_REQUESTED', 'a repeated assign is refused, not repeated');

select throws_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000b0b2', '00000000-0000-0000-0000-0000000000c2')$$,
  'P0001', 'BOOKING_NOT_ASSIGNED', 'a requested booking has nobody to change');
select throws_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000b0b4', '00000000-0000-0000-0000-0000000000c2')$$,
  'P0001', 'BOOKING_NOT_ASSIGNED', 'a visit in progress cannot be reassigned');
select throws_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'SAME_CAREGIVER', 'changing to the same caregiver is refused');
select throws_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c3')$$,
  'P0001', 'CAREGIVER_NOT_VERIFIED', 'changing to an unverified caregiver is refused');
select throws_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000dead', '00000000-0000-0000-0000-0000000000c2')$$,
  'P0001', 'BOOKING_NOT_FOUND', 'changing an unknown booking is refused');
select lives_ok($$select public.change_booking_caregiver('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c2')$$,
  'an Admin can change the caregiver of an assigned booking');

-- A caregiver whose verification was removed can no longer be assigned.
reset role;
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'removed', 'no longer verified', '00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select throws_ok($$select public.assign_booking('00000000-0000-0000-0000-00000000b0b2', '00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'CAREGIVER_NOT_VERIFIED', 'a caregiver whose verification was removed is refused');

reset role;

-- What was written ---------------------------------------------------------------------
select is((select status::text || '/' || assigned_caregiver_id::text || '/' || assigned_by::text
             from public.bookings where id = '00000000-0000-0000-0000-00000000b0b1'),
  'assigned/00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000ad',
  'the booking ends up assigned to the new caregiver by the Admin');
select ok((select assigned_at is not null from public.bookings where id = '00000000-0000-0000-0000-00000000b0b1'),
  'assigned_at is set');
select is((select count(*)::int from public.booking_assignments where booking_id = '00000000-0000-0000-0000-00000000b0b1'),
  2, 'one assignment row per successful call');
select is((select previous_caregiver_id from public.booking_assignments
            where booking_id = '00000000-0000-0000-0000-00000000b0b1' order by created_at limit 1),
  null::uuid, 'the first assignment has no previous caregiver');
select is((select previous_caregiver_id::text || '>' || caregiver_id::text from public.booking_assignments
            where booking_id = '00000000-0000-0000-0000-00000000b0b1' order by created_at desc limit 1),
  '00000000-0000-0000-0000-0000000000c1>00000000-0000-0000-0000-0000000000c2',
  'the change records who it replaced');
select is((select count(*)::int from public.booking_assignments), 2, 'failed calls wrote nothing');
select is((select status::text || '/' || coalesce(assigned_caregiver_id::text, '-')
             from public.bookings where id = '00000000-0000-0000-0000-00000000b0b2'),
  'requested/-', 'a refused assign leaves the booking untouched');
select matches(pg_get_functiondef('public.assign_booking(uuid, uuid)'::regprocedure), 'for share',
  'assign_booking locks the caregiver row for share');
select matches(pg_get_functiondef('public.change_booking_caregiver(uuid, uuid)'::regprocedure), 'for share',
  'change_booking_caregiver locks the caregiver row for share');
select matches(pg_get_functiondef('public.change_booking_caregiver(uuid, uuid)'::regprocedure), 'for update',
  'change_booking_caregiver locks the booking row');

select * from finish();
rollback;
