-- Tests for migration 0009 (DEV-033, caregiver and family reads).
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- ad = Admin; c1, c2 verified caregivers; c3 an unverified caregiver; f1, f2 families.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@t.test', '{"full_name":"Caregiver Three"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'f1@t.test', '{"full_name":"Family One"}', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@t.test', '{"full_name":"Family Two"}', '{}');

insert into public.caregiver_verifications (caregiver_id, action, note, acted_by) values
  ('00000000-0000-0000-0000-0000000000c1', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000000c2', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad');

insert into public.care_recipients (id, account_id, name, care_notes) values
  ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Recipient One', 'Takes insulin at 8'),
  ('00000000-0000-0000-0000-00000000c0f2', '00000000-0000-0000-0000-0000000000f2', 'Recipient Two', 'Private');

-- b1 assigned to c1, b2 still requested, b3 assigned to c2, b4 cancelled but still carrying c1.
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() + interval '1 day', 'assigned',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0b2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() + interval '2 days', 'requested', null, null, null),
  ('00000000-0000-0000-0000-00000000b0b3', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c0f2',
   'medicheck', now() + interval '3 days', 'assigned',
   '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0b4', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() + interval '4 days', 'cancelled',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());

insert into public.booking_assignments (booking_id, caregiver_id, assigned_by)
values ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad');

-- Caregiver c1, verified, assigned to b1 ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

select is((select count(*)::int from public.bookings), 1, 'a caregiver sees only their assigned booking (not the cancelled one)');
select is((select id from public.bookings), '00000000-0000-0000-0000-00000000b0b1'::uuid, 'and it is the right booking');
select is((select count(*)::int from public.care_recipients), 1, 'a caregiver sees only the recipient of that booking');
select is((select care_notes from public.care_recipients), 'Takes insulin at 8', 'with the care notes');
select is((select count(*)::int from public.care_recipients where id = '00000000-0000-0000-0000-00000000c0f2'), 0,
  'but not another family''s recipient');
select is((select count(*)::int from public.profiles), 1, 'a caregiver sees only their own profile');
select is((select count(*)::int from public.caregiver_verifications), 0, 'a caregiver cannot read the verification history');
select throws_ok($$update public.bookings set bundle_code = 'doctors_day_out'$$, '42501', null,
  'a caregiver cannot update a booking');

-- Verification removed: the booking and its recipient disappear at once -------------------
reset role;
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'removed', 'no longer verified', '00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.bookings), 0, 'removing the verification hides the booking');
select is((select count(*)::int from public.care_recipients), 0, 'and the recipient with its care notes');

-- Marked Verified again while still assigned: they come back ------------------------------
reset role;
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'verified', 'verified again', '00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.bookings), 1, 'marking Verified again brings the booking back');
select is((select count(*)::int from public.care_recipients), 1, 'and the recipient');

-- Unverified caregiver with no assignment --------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select is((select count(*)::int from public.bookings), 0, 'an unassigned caregiver sees no bookings');
select is((select count(*)::int from public.care_recipients), 0, 'and no recipients');

-- Family f1 ---------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.bookings), 3, 'a family sees all of their own bookings');
select is((select count(*)::int from public.care_recipients), 1, 'and their own recipient');
select is((select count(*)::int from public.profiles), 1, 'a family sees only their own profile');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 0,
  'so the assigned caregiver''s profile is not readable');
select is((select count(*)::int from public.caregiver_verifications), 0, 'a family cannot read the verification history');
select throws_ok($$update public.profiles set full_name = 'Renamed' where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '42501', null, 'a family cannot write to profiles');

-- Admin ----------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*)::int from public.bookings), 4, 'an Admin sees every booking');
select is((select count(*)::int from public.caregiver_verifications), 4, 'an Admin reads the verification history');
select is((select count(*)::int from public.booking_assignments), 1, 'an Admin reads the assignment history');
select is((select count(*)::int from public.profiles), 6, 'an Admin reads every profile');
select throws_ok($$update public.profiles set full_name = 'Renamed' where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '42501', null, 'not even an Admin can write to profiles through the API');

reset role;

-- Anonymous -------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select 1 from public.caregiver_verifications$$, '42501', null, 'anonymous users cannot read the history');
select is((select count(*)::int from public.care_recipients), 0, 'anonymous users see no recipients');
select throws_ok($$select 1 from public.bookings$$, '42501', null, 'anonymous users cannot read bookings');
reset role;

select is(has_function_privilege('anon', 'private.caregiver_sees_recipient(uuid)', 'execute'), false,
  'anon cannot run the recipient helper');

select * from finish();
rollback;
