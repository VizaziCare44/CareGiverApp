-- Tests for migration 0022 (care recipients cannot be deleted or truncated through the API). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@t.test', '{"full_name":"Family One"}', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@t.test', '{"full_name":"Family Two"}', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}');

insert into public.care_recipients (id, account_id, name) values
  ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Recipient One'),
  ('00000000-0000-0000-0000-00000000c0f2', '00000000-0000-0000-0000-0000000000f2', 'Recipient Two');

insert into public.bookings (account_id, care_recipient_id, bundle_code, requested_datetime) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now() + interval '1 day');

-- Family One ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select is((select count(*)::int from public.care_recipients), 1, 'a family reads only their own recipients');
select lives_ok(
  $$insert into public.care_recipients (account_id, name, care_notes)
    values ('00000000-0000-0000-0000-0000000000f1', 'Recipient One B', 'Takes tablets at breakfast.')$$,
  'a family can add a recipient');
select throws_ok(
  $$insert into public.care_recipients (account_id, name)
    values ('00000000-0000-0000-0000-0000000000f2', 'Not mine')$$,
  '42501', null, 'a family cannot add a recipient to another account');
select lives_ok(
  $$update public.care_recipients set care_notes = 'Updated note' where id = '00000000-0000-0000-0000-00000000c0f1'$$,
  'a family can still update their own recipient');
select throws_ok(
  $$update public.care_recipients set account_id = '00000000-0000-0000-0000-0000000000f2'
     where id = '00000000-0000-0000-0000-00000000c0f1'$$,
  '42501', null, 'a recipient cannot be moved to another account');

select throws_ok($$delete from public.care_recipients$$, '42501', null, 'a family cannot delete a recipient');
select throws_ok($$truncate public.care_recipients$$, '42501', null, 'a family cannot truncate recipients');

reset role;
select is((select count(*)::int from public.bookings where account_id = '00000000-0000-0000-0000-0000000000f1'), 1,
  'the family''s booking is still there after the refused delete');

-- Admin ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

select is((select count(*)::int from public.care_recipients
            where id in ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-00000000c0f2')),
  2, 'an Admin still reads every family''s recipients');
select throws_ok($$delete from public.care_recipients$$, '42501', null, 'an Admin cannot delete a recipient through the API either');

reset role;

-- Anonymous ------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.care_recipients$$, '42501', null, 'an anonymous caller cannot read recipients');

-- The owner can still remove an account with everything under it (provisioning and clean-up) ----
reset role;
select lives_ok(
  $$delete from auth.users where id = '00000000-0000-0000-0000-0000000000f2'$$,
  'removing an account still removes its recipients');

select * from finish();
rollback;
