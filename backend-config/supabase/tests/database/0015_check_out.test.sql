-- Tests for migration 0016 (DEV-060 second half, draft: check_out).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

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

-- b1 and b3: today, c1's. b2: in two days, c1's, never checked in to.
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now(), 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() + interval '2 days', 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now(), 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());

select is(has_function_privilege('anon', 'public.check_out(uuid, text)', 'execute'), false, 'anon cannot check out');
select is(has_function_privilege('authenticated', 'public.check_out(uuid, text)', 'execute'), true, 'signed-in users can run it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'c1 checks in to b1');
reset role;
select set_config('test.med', (select id::text from public.visit_tasks where name = 'Medication assistance'), true);
select set_config('test.vit', (select id::text from public.visit_tasks where name = 'Vitals check'), true);

-- Who may check out --------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'a family member cannot');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'an Admin cannot');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'CAREGIVER_NOT_VERIFIED', 'a Caregiver who is not Verified cannot');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'BOOKING_NOT_FOUND', 'another Caregiver''s booking looks like none');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000dead')$$, 'P0001', 'BOOKING_NOT_FOUND', 'an unknown booking');
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a2')$$, 'P0001', 'VISIT_NOT_FOUND', 'a booking never checked in to has no visit');

-- Required tasks first ------------------------------------------------------------------------------------------
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'REQUIRED_TASKS_MISSING', 'nothing logged');
select lives_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med')), 'Medication assistance logged Done');
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'REQUIRED_TASKS_MISSING', 'one Required task is still missing');
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1', null)$$, 'P0001', 'REQUIRED_TASKS_MISSING', 'also with no note');
select lives_ok(format($f$select public.log_visit_task(%L, 'not_done', null, 'Meter broken')$f$, current_setting('test.vit')), 'Vitals check logged Not done');
select throws_ok(format($f$select public.check_out('00000000-0000-0000-0000-00000000b0a1', %L)$f$, repeat('n', 2001)), 'P0001', 'VISIT_NOTE_TOO_LONG', 'a visit note over 2,000 characters');
select is((select status::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'in_progress', 'still in progress after the refusals');

-- Checking out: the Optional task is left, the visit and booking close --------------------------------------------------
select is(public.check_out('00000000-0000-0000-0000-00000000b0a1', E'  Went well \n') ->> 'changed', 'true', 'checked out with the Optional task unlogged');
select set_config('test.out', (select checked_out_at::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), true);
select is((select status::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'completed', 'the booking is completed');
select is((select visit_note from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'Went well', 'with the trimmed note');
select ok((select checked_out_at from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1') is not null, 'and the time');

-- A repeat changes nothing
select is(public.check_out('00000000-0000-0000-0000-00000000b0a1', 'A different note') ->> 'changed', 'false', 'a repeat writes nothing');
select is((select visit_note from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'Went well', 'the note is as it was');
select is((select checked_out_at::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), current_setting('test.out'), 'and so is the time');

-- Closed for good
select throws_ok(format($f$select public.log_visit_task(%L, 'done', 'late')$f$, current_setting('test.vit')), 'P0001', 'VISIT_CLOSED', 'no task can be changed now');

-- A second visit, with the longest note, and no note at all ---------------------------------------------------------
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a3')$$, 'the next visit starts (none is open now)');
reset role;
select set_config('test.med3', (select t.id::text from public.visit_tasks t join public.visits v on v.id = t.visit_id where v.booking_id = '00000000-0000-0000-0000-00000000b0a3' and t.name = 'Medication assistance'), true);
select set_config('test.vit3', (select t.id::text from public.visit_tasks t join public.visits v on v.id = t.visit_id where v.booking_id = '00000000-0000-0000-0000-00000000b0a3' and t.name = 'Vitals check'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med3')), 'Medication assistance Done');
select lives_ok(format($f$select public.log_visit_task(%L, 'done', '118/76')$f$, current_setting('test.vit3')), 'Vitals check Done');
select is(public.check_out('00000000-0000-0000-0000-00000000b0a3', repeat('n', 2000)) ->> 'changed', 'true', 'a 2,000 character note is kept');
reset role;
select is((select char_length(visit_note) from public.visits v where v.booking_id = '00000000-0000-0000-0000-00000000b0a3'), 2000, 'whole');
select is((select count(*) from public.visits where checked_out_at is null), 0::bigint, 'no visit is left open');

select * from finish();
rollback;
