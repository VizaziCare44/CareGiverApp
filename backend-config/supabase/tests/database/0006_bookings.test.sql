-- Tests for migration 0006 (DEV-030, bookings write path). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- f1 and f2 are families, ad is an Admin, cg a caregiver.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@t.test', '{"full_name":"Family One"}', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@t.test', '{"full_name":"Family Two"}', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000cc', 'cg@t.test', '{"full_name":"Caregiver"}', '{"role":"caregiver"}');

insert into public.care_recipients (id, account_id, name) values
  ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Recipient One'),
  ('00000000-0000-0000-0000-00000000c0f2', '00000000-0000-0000-0000-0000000000f2', 'Recipient Two');

insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '1 day'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c0f2', 'medicheck', now() + interval '1 day');

-- Family One ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select is((select count(*)::int from public.bookings), 1, 'a family reads only their own bookings');

select lives_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'doctors_day_out', now() + interval '2 days')$$,
  'a family can insert with the four allowed columns');
select is((select count(*)::int from public.bookings where status = 'requested'), 2,
  'the new booking starts as requested');

select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime, status)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(), 'requested')$$,
  '42501', null, 'status cannot be sent, even as requested');
select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime, assigned_caregiver_id)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(),
            '00000000-0000-0000-0000-0000000000cc')$$,
  '42501', null, 'a caregiver cannot be set');
select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime, assigned_at)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(), now())$$,
  '42501', null, 'assignment fields cannot be set');
select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime, created_at)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(), now() - interval '9 days')$$,
  '42501', null, 'the requested time (created_at) cannot be set');
select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f2', 'medicheck', now())$$,
  '42501', null, 'the recipient must belong to the same family');
select throws_ok(
  $$insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c0f2', 'medicheck', now())$$,
  '42501', null, 'a booking cannot be created for another account');
select throws_ok($$update public.bookings set bundle_code = 'doctors_day_out'$$, '42501', null,
  'a family cannot update a booking');
select throws_ok($$delete from public.bookings$$, '42501', null, 'a family cannot delete a booking');
select throws_ok($$truncate public.bookings$$, '42501', null, 'a family cannot truncate bookings');

reset role;

-- Admin ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

select is((select count(*)::int from public.bookings), 3, 'an Admin reads every booking');
select throws_ok($$update public.bookings set bundle_code = 'doctors_day_out'$$, '42501', null,
  'an Admin cannot update a booking through the API either');

reset role;

-- Anonymous ------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select 1 from public.bookings$$, '42501', null, 'anonymous users have no access');
reset role;

-- Family Two removes a recipient: the cascade still deletes its bookings even
-- though the family has no DELETE right on bookings itself.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select lives_ok(
  $$delete from public.care_recipients where id = '00000000-0000-0000-0000-00000000c0f2'$$,
  'a family can still remove their own care recipient');
reset role;
select is((select count(*)::int from public.bookings
            where care_recipient_id = '00000000-0000-0000-0000-00000000c0f2'),
  0, 'removing the recipient removed its bookings');

-- Admin read still works after all of the above, and the Family One data is intact.
select is((select count(*)::int from public.bookings where account_id = '00000000-0000-0000-0000-0000000000f1'),
  2, 'Family One keeps their two bookings');

select * from finish();
rollback;
