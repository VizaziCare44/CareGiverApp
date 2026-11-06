-- Tests for log_visit_task as FD-VISIT section 7.3 defines it (migration 0015, rebuilt by 0020):
-- (booking id, task_key, outcome, note, reason), the codes of the spec table, the limits of 7.8(d).
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

-- b0a1: c1's MediCheck visit today (checked in below); b0a9: a booking with no visit
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now(), 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a9', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() + interval '2 days', 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());

select is(has_function_privilege('anon', 'public.log_visit_task(uuid, text, text, text, text)', 'execute'), false, 'anon cannot log a task');
select is(has_function_privilege('authenticated', 'public.log_visit_task(uuid, text, text, text, text)', 'execute'), true, 'signed-in users can run it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'c1 checks in');

-- Who may log ----------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done')$$, '42501', 'NOT_CAREGIVER', 'a family member cannot log');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done')$$, '42501', 'NOT_CAREGIVER', 'an Admin cannot log');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done')$$, 'P0001', 'VISIT_NOT_FOUND', 'a Caregiver who is not Verified gets the not-found answer');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done')$$, 'P0001', 'VISIT_NOT_FOUND', 'another Caregiver''s visit looks like none');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000dead', 'medication_assistance', 'done')$$, 'P0001', 'VISIT_NOT_FOUND', 'an unknown booking');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a9', 'medication_assistance', 'done')$$, 'P0001', 'VISIT_NOT_FOUND', 'a booking never checked in to');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'transport_and_escort', 'done')$$, 'P0001', 'TASK_NOT_FOUND', 'a task of the other bundle');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'nonsense', 'done')$$, 'P0001', 'TASK_NOT_FOUND', 'an unknown task key');

-- The rules ------------------------------------------------------------------------------------------------------
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'maybe')$$, 'P0001', 'INVALID_OUTCOME', 'an unknown outcome');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', null)$$, 'P0001', 'INVALID_OUTCOME', 'no outcome');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'done')$$, 'P0001', 'NOTE_REQUIRED', 'Done on a task that needs a note needs one');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'done', E'  \n ')$$, 'P0001', 'NOTE_REQUIRED', 'spaces are not a note');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'not_done')$$, 'P0001', 'REASON_REQUIRED', 'Not done needs a reason');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'not_done', 'a note', '  ')$$, 'P0001', 'REASON_REQUIRED', 'and a note is not a reason');
select throws_ok(format($f$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'companionship', 'done', %L)$f$, repeat('a', 2001)), 'P0001', 'TEXT_TOO_LONG', '2,001 characters is too long for a note');
select throws_ok(format($f$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'companionship', 'not_done', null, %L)$f$, repeat('a', 501)), 'P0001', 'TEXT_TOO_LONG', '501 is too long for a reason');
select throws_ok(format($f$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'companionship', 'done', %L)$f$, repeat('é', 2001)), 'P0001', 'TEXT_TOO_LONG', 'the limit counts characters, not bytes');

select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'companionship', 'done', repeat('é', 2000)) ->> 'changed', 'true', 'a 2,000 character note (two bytes each) is kept');
select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'companionship', 'not_done', null, repeat('r', 500)) ->> 'changed', 'true', 'and a 500 character reason');
select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done') ->> 'changed', 'true', 'a task with no required note logs Done without one');
select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done') ->> 'changed', 'false', 'sending the same again writes nothing and returns the entry');
select ok((public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done') ->> 'entry_id') is not null, 'with its id');
select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'done', E'  120/80, 6.1 \n', 'ignored') ->> 'changed', 'true', 'Done with a note; the reason is ignored');
select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'done', '120/80, 6.1') ->> 'changed', 'false', 'the same note, trimmed, is the same entry');

-- Changing a task: a new entry, the earlier one stays, the later one counts
select is(public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'not_done', 'ignored', 'Refused the tablets') ->> 'changed', 'true', 'changed to Not done');
select is((select outcome::text from public.caregiver_visit_tasks where task_key = 'medication_assistance'), 'not_done', 'which now counts');
select is((select reason from public.caregiver_visit_tasks where task_key = 'medication_assistance'), 'Refused the tablets', 'with its reason');
select is((select note from public.caregiver_visit_tasks where task_key = 'vitals_check'), '120/80, 6.1', 'text is trimmed');

reset role;
select is((select count(*) from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id where t.task_key = 'medication_assistance'), 2::bigint, 'the earlier entry stays in the record');
select is((select note from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id where t.task_key = 'medication_assistance' and e.outcome = 'not_done'), null::text, 'a note is not kept on Not done');
select is((select reason from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id where t.task_key = 'vitals_check'), null::text, 'a reason is not kept on Done');
select is((select count(*) from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id where t.task_key = 'companionship'), 2::bigint, 'the long ones were written');
select is((select count(*) from public.visit_task_entries where logged_by = '00000000-0000-0000-0000-0000000000c1'), (select count(*) from public.visit_task_entries),
  'every entry says who logged it: the signed-in Caregiver, set by the function');

-- After check-out ---------------------------------------------------------------------------------------------------
update public.visits set checked_out_at = clock_timestamp() + interval '1 second', visit_note = 'Done';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'medication_assistance', 'done')$$, 'P0001', 'VISIT_ALREADY_CHECKED_OUT', 'a task cannot be logged after check-out');
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000b0a1', 'vitals_check', 'not_done', null, 'Changed my mind')$$, 'P0001', 'VISIT_ALREADY_CHECKED_OUT', 'nor changed');

select * from finish();
rollback;
