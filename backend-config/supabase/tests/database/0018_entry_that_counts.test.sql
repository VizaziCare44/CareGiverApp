-- Tests for the shared "entry that counts" helper private.visit_task_latest (DEV-072; FR-005, BR-002;
-- created by migration 0014; DRAFT). The helper is the one place that says which entry counts for a
-- task: the one with the highest id. These tests are about the helper itself, and that
-- caregiver_visit_tasks returns exactly what the rule says, row for row.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'fm@t.test', '{"full_name":"Family"}', '{}');
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad');
insert into public.care_recipients (id, account_id, name)
values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Mzee Test');
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status, assigned_caregiver_id, assigned_by, assigned_at)
values ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(), 'in_progress',
        '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());
insert into public.visits (id, booking_id, caregiver_id, checked_in_at)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000c1', now());
insert into public.visit_tasks (visit_id, checklist_item_id, sort_order, name, required, note_required)
select '00000000-0000-0000-0000-0000000000a1', id, sort_order, name, required, note_required from public.checklist_items where bundle_code = 'medicheck';

-- The shape ----------------------------------------------------------------------------------------------
select is((select count(*) from information_schema.columns
            where table_schema = 'private' and table_name = 'visit_task_latest'
              and column_name in ('visit_task_id', 'outcome', 'note', 'reason', 'logged_at')),
  5::bigint, 'the helper has visit_task_id, outcome, note, reason and logged_at');
select is((select count(*) from pg_views where schemaname = 'private' and viewname = 'visit_task_latest'), 1::bigint, 'it is a view in the private schema');
select is((select definition ilike '%caregiver_visit_tasks%' from pg_views where schemaname = 'private' and viewname = 'visit_task_latest'), false, 'it does not depend on its reader');
select is((select count(*) from pg_views where schemaname = 'public' and viewname = 'caregiver_visit_tasks' and definition ilike '%visit_task_latest%'),
  1::bigint, 'caregiver_visit_tasks reads the helper and does not define the rule again');

-- No grant to any API role ---------------------------------------------------------------------------------
select is(has_table_privilege('anon', 'private.visit_task_latest', 'select'), false, 'anon has no right on the helper');
select is(has_table_privilege('authenticated', 'private.visit_task_latest', 'select'), false, 'signed-in users have no right on the helper');

-- Entries: A (Medication assistance) logged three times; B (Vitals check) logged twice, the later entry
-- with the EARLIER time; C (Companionship) never.
insert into public.visit_task_entries (visit_task_id, outcome, note, logged_at)
  select id, 'done', 'First', now() from public.visit_tasks where name = 'Medication assistance';
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_at)
  select id, 'not_done', 'Second', now() from public.visit_tasks where name = 'Medication assistance';
insert into public.visit_task_entries (visit_task_id, outcome, note, logged_at)
  select id, 'done', 'Third', now() from public.visit_tasks where name = 'Medication assistance';

insert into public.visit_task_entries (visit_task_id, outcome, note, logged_at)
  select id, 'done', 'Later time, earlier id', now() + interval '1 hour' from public.visit_tasks where name = 'Vitals check';
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_at)
  select id, 'not_done', 'Earlier time, later id', now() - interval '1 hour' from public.visit_tasks where name = 'Vitals check';

create temp table task_ids as select name, id from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000a1';

-- A task logged three times returns only the last entry
select is((select count(*) from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Medication assistance')),
  1::bigint, 'a task logged three times has one row');
select is((select note from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Medication assistance')),
  'Third', 'and it is the last entry');
select is((select outcome::text from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Medication assistance')),
  'done', 'with its outcome');
select is((select reason from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Medication assistance')),
  null::text, 'and not the reason of the entry before it');
select is((select count(*) from public.visit_task_entries where visit_task_id = (select id from task_ids where name = 'Medication assistance')),
  3::bigint, 'while all three entries are still stored');

-- A task with no entry has no row
select is((select count(*) from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Companionship')),
  0::bigint, 'a task with no entry has no row');

-- The highest id wins even if its time is earlier
select is((select reason from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Vitals check')),
  'Earlier time, later id', 'the highest id wins even though its time is earlier');
select is((select outcome::text from private.visit_task_latest where visit_task_id = (select id from task_ids where name = 'Vitals check')),
  'not_done', 'with its outcome');
select is((select count(*) from private.visit_task_latest where visit_task_id in (select id from task_ids)), 2::bigint, 'two of the three tasks have a row');

-- The helper is exactly the rule: for every task, the entry with the highest id (written out another way)
create temp table reference as
select t.id as task_id, e.outcome, e.note, e.reason, e.logged_at
  from public.visit_tasks t
  left join public.visit_task_entries e on e.id = (select max(e2.id) from public.visit_task_entries e2 where e2.visit_task_id = t.id)
 where t.visit_id = '00000000-0000-0000-0000-0000000000a1';
grant select on reference to authenticated;

select is_empty($$select visit_task_id, outcome, note, reason, logged_at from private.visit_task_latest
                  except select task_id, outcome, note, reason, logged_at from reference where outcome is not null$$,
  'the helper has nothing the rule does not give');
select is_empty($$select task_id, outcome, note, reason, logged_at from reference where outcome is not null
                  except select visit_task_id, outcome, note, reason, logged_at from private.visit_task_latest$$,
  'and misses nothing the rule gives');

-- caregiver_visit_tasks returns exactly those rows (and one for a task with no entry), for its own Caregiver
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit_tasks), 3::bigint, 'caregiver_visit_tasks has one row per task');
select is_empty($$select task_id, outcome, note, reason, logged_at from public.caregiver_visit_tasks
                  except select task_id, outcome, note, reason, logged_at from reference$$,
  'caregiver_visit_tasks has nothing the rule does not give');
select is_empty($$select task_id, outcome, note, reason, logged_at from reference
                  except select task_id, outcome, note, reason, logged_at from public.caregiver_visit_tasks$$,
  'and misses nothing the rule gives');
select is((select outcome::text from public.caregiver_visit_tasks where name = 'Companionship'), null::text, 'a task with no entry shows no outcome');

-- An API role cannot select from the helper
select throws_ok($$select * from private.visit_task_latest$$, '42501', null, 'a signed-in user cannot select from the helper');

reset role;
select * from finish();
rollback;
