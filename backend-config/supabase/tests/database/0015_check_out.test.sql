-- Tests for check_out as FD-VISIT section 7.3 defines it (migration 0016, rebuilt by 0020):
-- (booking id, visit note) -> {booking_id, checked_out_at}; Required tasks first, then the note limit.
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

-- Who may check out --------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'a family member cannot');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'an Admin cannot');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'VISIT_NOT_FOUND', 'a Caregiver who is not Verified gets the not-found answer');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'VISIT_NOT_FOUND', 'another Caregiver''s booking looks like none');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000dead')$$, 'P0001', 'VISIT_NOT_FOUND', 'an unknown booking');
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a2')$$, 'P0001', 'VISIT_NOT_FOUND', 'a booking never checked in to has no visit');

-- Required tasks first ------------------------------------------------------------------------------------------
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'REQUIRED_TASKS_MISSING', 'nothing logged');
select lives_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done')$$, 'Medication assistance logged Done');
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'REQUIRED_TASKS_MISSING', 'one Required task is still missing');
select throws_ok($$select public.check_out('00000000-0000-0000-0000-00000000b0a1', null)$$, 'P0001', 'REQUIRED_TASKS_MISSING', 'also with no note');
select throws_ok(format($f$select public.check_out('00000000-0000-0000-0000-00000000b0a1', %L)$f$, repeat('n', 2001)), 'P0001', 'REQUIRED_TASKS_MISSING',
  'a Required task missing is reported before a note that is too long (the order of 7.3)');
select lives_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'not_done', null, 'Meter broken')$$, 'Vitals check logged Not done');
select throws_ok(format($f$select public.check_out('00000000-0000-0000-0000-00000000b0a1', %L)$f$, repeat('n', 2001)), 'P0001', 'TEXT_TOO_LONG', 'a visit note over 2,000 characters');
select is((select count(*) from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1' and checked_out_at is null), 1::bigint, 'still open after the refusals');

-- Checking out: the Optional task is left, the visit and booking close --------------------------------------------------
select is(public.check_out('00000000-0000-0000-0000-00000000b0a1', E'  Went well \n') ->> 'booking_id', '00000000-0000-0000-0000-00000000b0a1', 'checked out with the Optional task unlogged');
select set_config('test.out', (select checked_out_at::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), true);
select is((select visit_note from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'Went well', 'with the trimmed note');
select ok((select checked_out_at from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1') is not null, 'and the time');

-- A repeat changes nothing (a retry)
select is(public.check_out('00000000-0000-0000-0000-00000000b0a1', 'A different note') ->> 'checked_out_at', (select checked_out_at::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'),
  'a repeat returns the same time');
select is((select visit_note from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'Went well', 'the note is as it was');
select is((select checked_out_at::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), current_setting('test.out'), 'and so is the time');

-- Closed for good
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'done', 'late')$$, 'P0001', 'VISIT_ALREADY_CHECKED_OUT', 'no task can be changed now');

-- A second visit, with the longest note ---------------------------------------------------------
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a3')$$, 'the next visit starts (none is open now)');
select lives_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a3', 'medication_assistance', 'done')$$, 'Medication assistance Done');
select lives_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a3', 'vitals_check', 'done', '118/76')$$, 'Vitals check Done');
select is(public.check_out('00000000-0000-0000-0000-00000000b0a3', repeat('n', 2000)) ->> 'booking_id', '00000000-0000-0000-0000-00000000b0a3', 'a 2,000 character note is kept');
reset role;
select is((select char_length(visit_note) from public.visits v where v.booking_id = '00000000-0000-0000-0000-00000000b0a3'), 2000, 'whole');
select is((select count(*) from public.visits where checked_out_at is null), 0::bigint, 'no visit is left open');
select is((select string_agg(status::text, ',' order by id) from public.bookings where id in ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-00000000b0a3')),
  'completed,completed', 'both bookings are completed');

select * from finish();
rollback;
