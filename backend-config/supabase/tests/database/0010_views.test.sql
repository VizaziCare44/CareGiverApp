-- Tests for migration 0010 (DEV-034, the three views).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ad = Admin; c1 a Verified caregiver; c2 a caregiver who was never verified; f1, f2 families.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'f1@t.test', '{"full_name":"Family One","phone":"+254700000001"}', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@t.test', '{"full_name":"Family Two"}', '{}');

insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad');

insert into public.care_recipients (id, account_id, name) values
  ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Recipient One'),
  ('00000000-0000-0000-0000-00000000c0f2', '00000000-0000-0000-0000-0000000000f2', 'Recipient Two');

-- f1: b1 requested; b2 assigned to c1 (verified); b3 assigned to c2 (not verified);
--     b4 in progress with c2; b5 completed with c2.  f2: b6 assigned to c1.
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '1 day', 'requested', null, null, null),
  ('00000000-0000-0000-0000-00000000b0b2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '2 days', 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0b3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '3 days', 'assigned', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0b4', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() - interval '1 hour', 'in_progress', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0b5', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() - interval '2 days', 'completed', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0b6', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c0f2', 'medicheck', now() + interval '4 days', 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());

set local role authenticated;

-- Family f1: family_bookings ----------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select is((select count(*)::int from public.family_bookings), 5, 'a family sees exactly their own bookings');
select is((select caregiver_name is null from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b1'), true,
  'no caregiver yet: no name');
select is((select caregiver_verified is null from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b1'), true,
  'no caregiver yet: caregiver_verified is null');
select is((select caregiver_name || '/' || caregiver_verified::text
             from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b2'),
  'Caregiver One/true', 'assigned to a Verified caregiver: name and verified');
select is((select caregiver_name is null and caregiver_verified = false
             from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b3'), true,
  'assigned, not started, caregiver not Verified: name withheld');
select is((select caregiver_name || '/' || caregiver_verified::text
             from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b4'),
  'Caregiver Two/false', 'visit in progress: name returned whatever the status');
select is((select caregiver_name || '/' || caregiver_verified::text
             from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b5'),
  'Caregiver Two/false', 'visit completed: name returned whatever the status');
select is((select count(*)::int from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b6'), 0,
  'another family''s booking is not visible');
select is((select string_agg(column_name::text, ',' order by ordinal_position)
             from information_schema.columns
            where table_schema = 'public' and table_name = 'family_bookings'),
  'id,care_recipient_id,care_recipient_name,bundle_code,requested_datetime,status,created_at,assigned_at,caregiver_name,caregiver_verified',
  'family_bookings returns nothing else about the caregiver');
select is((select count(*)::int from public.admin_booking_overview), 0, 'a family gets no rows from admin_booking_overview');
select is((select count(*)::int from public.caregiver_overview), 0, 'a family gets no rows from caregiver_overview');

-- Admin ------------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

select is((select count(*)::int from public.admin_booking_overview), 6, 'an Admin sees every booking in the overview');
select is((select caregiver_name || '/' || caregiver_verified::text || '/' || family_name
             from public.admin_booking_overview where id = '00000000-0000-0000-0000-00000000b0b2'),
  'Caregiver One/true/Family One', 'the overview shows caregiver, whether Verified, and the family');
select is((select caregiver_verified from public.admin_booking_overview where id = '00000000-0000-0000-0000-00000000b0b3'), false,
  'an unverified caregiver is flagged for the "reassign" panel');
select is((select count(*)::int from public.caregiver_overview), 2, 'an Admin sees both caregivers');
select is((select verified::text || '/' || last_changed_by_name
             from public.caregiver_overview where id = '00000000-0000-0000-0000-0000000000c1'),
  'true/Admin', 'a verified caregiver shows who changed it last');
select is((select verified = false and last_changed_at is null
             from public.caregiver_overview where id = '00000000-0000-0000-0000-0000000000c2'), true,
  'a never-verified caregiver shows not verified and no change yet');
select is((select count(*)::int from public.family_bookings), 0,
  'family_bookings returns only the caller''s own bookings, an Admin included');

-- Caregiver c1 -------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.caregiver_overview) + (select count(*)::int from public.admin_booking_overview),
  0, 'a caregiver gets no rows from the Admin views');

-- Anonymous ------------------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select 1 from public.family_bookings$$, '42501', null, 'anonymous users cannot read family_bookings');
select throws_ok($$select 1 from public.admin_booking_overview$$, '42501', null, 'anonymous users cannot read admin_booking_overview');
select throws_ok($$select 1 from public.caregiver_overview$$, '42501', null, 'anonymous users cannot read caregiver_overview');
reset role;

-- A removed verification hides the name while the visit has not started -------------------------
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'removed', 'no longer verified', '00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select caregiver_name is null and caregiver_verified = false
             from public.family_bookings where id = '00000000-0000-0000-0000-00000000b0b2'), true,
  'after the verification is removed the name is withheld again');
reset role;

select * from finish();
rollback;
