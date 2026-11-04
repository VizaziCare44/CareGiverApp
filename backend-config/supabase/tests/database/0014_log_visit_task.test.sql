-- Tests for migration 0015 (DEV-061 draft: log_visit_task, with the limit and task-name corrections).
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

insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now(), 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());

-- The two corrections ---------------------------------------------------------------------------------
select is((select count(*) from public.checklist_items where bundle_code = 'doctors_day_out' and name = 'Post-visit summary'), 1::bigint,
  'the Doctor''s Day Out task is Post-visit summary');
select is((select count(*) from public.checklist_items where name = 'Post-visit report'), 0::bigint, 'and nothing is called Post-visit report');
select is(has_function_privilege('anon', 'public.log_visit_task(uuid, text, text, text)', 'execute'), false, 'anon cannot log a task');
select is(has_function_privilege('authenticated', 'public.log_visit_task(uuid, text, text, text)', 'execute'), true, 'signed-in users can run it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'c1 checks in');
reset role;

select set_config('test.med', (select id::text from public.visit_tasks where name = 'Medication assistance'), true);
select set_config('test.vit', (select id::text from public.visit_tasks where name = 'Vitals check'), true);
select set_config('test.com', (select id::text from public.visit_tasks where name = 'Companionship'), true);

-- Who may log ----------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med')), '42501', 'NOT_CAREGIVER', 'a family member cannot log');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select throws_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med')), '42501', 'NOT_CAREGIVER', 'an Admin cannot log');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med')), 'P0001', 'CAREGIVER_NOT_VERIFIED', 'a Caregiver who is not Verified cannot log');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med')), 'P0001', 'TASK_NOT_FOUND', 'another Caregiver''s task looks like no task');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.log_visit_task('00000000-0000-0000-0000-00000000dead', 'done')$$, 'P0001', 'TASK_NOT_FOUND', 'an unknown task');

-- The rules ------------------------------------------------------------------------------------------------------
select throws_ok(format($f$select public.log_visit_task(%L, 'maybe')$f$, current_setting('test.med')), 'P0001', 'INVALID_OUTCOME', 'an unknown outcome');
select throws_ok(format($f$select public.log_visit_task(%L, null)$f$, current_setting('test.med')), 'P0001', 'INVALID_OUTCOME', 'no outcome');
select throws_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.vit')), 'P0001', 'NOTE_REQUIRED', 'Done on a task that needs a note needs one');
select throws_ok(format($f$select public.log_visit_task(%L, 'done', E'  \n ')$f$, current_setting('test.vit')), 'P0001', 'NOTE_REQUIRED', 'spaces are not a note');
select throws_ok(format($f$select public.log_visit_task(%L, 'not_done')$f$, current_setting('test.med')), 'P0001', 'REASON_REQUIRED', 'Not done needs a reason');
select throws_ok(format($f$select public.log_visit_task(%L, 'not_done', 'a note', '  ')$f$, current_setting('test.med')), 'P0001', 'REASON_REQUIRED', 'and a note is not a reason');
select throws_ok(format($f$select public.log_visit_task(%L, 'done', %L)$f$, current_setting('test.com'), repeat('a', 2001)), 'P0001', 'NOTE_TOO_LONG', '2,001 characters is too long for a note');
select throws_ok(format($f$select public.log_visit_task(%L, 'not_done', null, %L)$f$, current_setting('test.com'), repeat('a', 501)), 'P0001', 'REASON_TOO_LONG', '501 is too long for a reason');

select is(public.log_visit_task(current_setting('test.com')::uuid, 'done', repeat('n', 2000)) ->> 'changed', 'true', 'a 2,000 character note is kept');
select is(public.log_visit_task(current_setting('test.com')::uuid, 'not_done', null, repeat('r', 500)) ->> 'changed', 'true', 'and a 500 character reason');
select is(public.log_visit_task(current_setting('test.med')::uuid, 'done') ->> 'changed', 'true', 'a task with no required note logs Done without one');
select is(public.log_visit_task(current_setting('test.med')::uuid, 'done') ->> 'changed', 'false', 'sending the same again writes nothing');
select is(public.log_visit_task(current_setting('test.vit')::uuid, 'done', E'  120/80, 6.1 \n', 'ignored') ->> 'changed', 'true', 'Done with a note');
select is(public.log_visit_task(current_setting('test.vit')::uuid, 'done', '120/80, 6.1') ->> 'changed', 'false', 'the same note, trimmed, is the same entry');

-- Changing a task: a new entry, the earlier one stays, the later one counts
select is(public.log_visit_task(current_setting('test.med')::uuid, 'not_done', 'ignored', 'Refused the tablets') ->> 'changed', 'true', 'changed to Not done');
select is((select outcome::text from public.caregiver_visit_tasks where name = 'Medication assistance'), 'not_done', 'which now counts');
select is((select reason from public.caregiver_visit_tasks where name = 'Medication assistance'), 'Refused the tablets', 'with its reason');
select is((select note from public.caregiver_visit_tasks where name = 'Vitals check'), '120/80, 6.1', 'text is trimmed and a reason is not kept on Done');

reset role;
select is((select count(*) from public.visit_task_entries where visit_task_id = current_setting('test.med')::uuid), 2::bigint, 'the earlier entry stays in the record');
select is((select note from public.visit_task_entries where visit_task_id = current_setting('test.med')::uuid and outcome = 'not_done'), null::text, 'a note is not kept on Not done');
select is((select reason from public.visit_task_entries where visit_task_id = current_setting('test.vit')::uuid), null::text, 'a reason is not kept on Done');
select is((select count(*) from public.visit_task_entries where visit_task_id = current_setting('test.com')::uuid), 2::bigint, 'the long ones were written');

-- After check-out ---------------------------------------------------------------------------------------------------
update public.visits set checked_out_at = clock_timestamp() + interval '1 second', visit_note = 'Done';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(format($f$select public.log_visit_task(%L, 'done')$f$, current_setting('test.med')), 'P0001', 'VISIT_CLOSED', 'a task cannot be logged after check-out');
select throws_ok(format($f$select public.log_visit_task(%L, 'not_done', null, 'Changed my mind')$f$, current_setting('test.vit')), 'P0001', 'VISIT_CLOSED', 'nor changed');

select * from finish();
rollback;
