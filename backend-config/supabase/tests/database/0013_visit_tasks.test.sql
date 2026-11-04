-- Tests for migration 0014 (DEV-072 / DEV-062 part: private.visit_task_latest, caregiver_visit_tasks; DRAFT).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}'),
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

-- Each bundle has exactly one Optional task (DEV-065) ---------------------------------------------
select is((select count(*) from public.checklist_items where bundle_code = 'medicheck' and not required), 1::bigint, 'MediCheck has one Optional task');
select is((select count(*) from public.checklist_items where bundle_code = 'doctors_day_out' and not required), 1::bigint, 'Doctor''s Day Out has one Optional task');

-- The rule is defined once, and only for the database ---------------------------------------------------
select is(has_table_privilege('authenticated', 'private.visit_task_latest', 'select'), false, 'no API role reads the "entry that counts" view');
select is(has_table_privilege('anon', 'public.caregiver_visit_tasks', 'select'), false, 'anon cannot read caregiver_visit_tasks');
select is(has_table_privilege('authenticated', 'public.caregiver_visit_tasks', 'select'), true, 'signed-in users can');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit_tasks), 0::bigint, 'before check-in there are no tasks');
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'check in');
select is((select count(*) from public.caregiver_visit_tasks), 3::bigint, 'after check-in, the three tasks');
select is((select string_agg(name, ', ' order by sort_order) from public.caregiver_visit_tasks),
  'Medication assistance, Vitals check, Companionship', 'in checklist order');
select is((select count(*) from public.caregiver_visit_tasks where outcome is not null), 0::bigint, 'none logged yet');

-- Entries: the one with the highest id counts ------------------------------------------------------------
reset role;
insert into public.visit_task_entries (visit_task_id, outcome, note, logged_at)
  select id, 'done', 'First', now() from public.visit_tasks where name = 'Medication assistance';
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_at)
  select id, 'not_done', 'Changed my mind', now() from public.visit_tasks where name = 'Medication assistance';
insert into public.visit_task_entries (visit_task_id, outcome, note, logged_at)
  select id, 'done', '120/80', now() from public.visit_tasks where name = 'Vitals check';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select outcome::text from public.caregiver_visit_tasks where name = 'Medication assistance'), 'not_done', 'the later entry counts');
select is((select reason from public.caregiver_visit_tasks where name = 'Medication assistance'), 'Changed my mind', 'with its reason');
select is((select note from public.caregiver_visit_tasks where name = 'Medication assistance'), null::text, 'and not the earlier note');
select is((select note from public.caregiver_visit_tasks where name = 'Vitals check'), '120/80', 'a task with one entry shows it');
select is((select outcome::text from public.caregiver_visit_tasks where name = 'Companionship'), null::text, 'a task with none has no outcome');
select is((select count(*) from public.caregiver_visit_tasks), 3::bigint, 'still one row per task');

-- Who may read them --------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit_tasks), 0::bigint, 'another Caregiver reads none of them');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit_tasks), 0::bigint, 'a family member reads none');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit_tasks), 0::bigint, 'nor does an Admin, through this view');

-- A Caregiver who is no longer Verified reads nothing
reset role;
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'removed', 'gone', '00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit_tasks), 0::bigint, 'a Caregiver who is not Verified reads no tasks');

select * from finish();
rollback;
