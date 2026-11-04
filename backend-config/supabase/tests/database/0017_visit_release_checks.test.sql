-- The release checks of docs/FD-VISIT Runbook Addendum.md (DEV-071), run here on a database that
-- has every migration. The addendum tells the Tech Lead to run these same queries on the
-- production project; running them in CI first proves each query is correct and returns the stated
-- result. If you change a query here, change it in the addendum (and the other way round).
-- DRAFT: the visit schema it checks is a draft until FD-VISIT section 7 has been checked.
-- Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- The check after each migration (addendum part 1)
-- ---------------------------------------------------------------------------

-- 0011 visit_schema
select is((select count(*) from information_schema.tables
            where table_schema = 'public' and table_name in ('checklist_items', 'visits', 'visit_tasks', 'visit_task_entries')),
  4::bigint, '0011: the four visit tables exist');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname in ('checklist_items', 'visits', 'visit_tasks', 'visit_task_entries') and c.relrowsecurity),
  4::bigint, '0011: row-level security is on for all four');
select is(not has_table_privilege('anon', 'public.visits', 'select') and not has_table_privilege('authenticated', 'public.visits', 'select')
      and not has_table_privilege('authenticated', 'public.visit_tasks', 'select')
      and not has_table_privilege('authenticated', 'public.visit_task_entries', 'select')
      and not has_table_privilege('authenticated', 'public.visits', 'insert'),
  true, '0011: the API roles have no rights on visits, visit_tasks or visit_task_entries');
select is((select count(*) from pg_trigger
            where tgname in ('visits_guard', 'visit_tasks_append_only', 'visit_task_entries_append_only', 'visit_task_entries_open_visit_only')
              and not tgisinternal),
  4::bigint, '0011: the four rules the tables keep for themselves are in place');
select is((select count(*) from information_schema.columns
            where table_schema = 'public' and table_name in ('visits', 'visit_tasks', 'visit_task_entries')
              and column_name ~* 'location|device|ip_|_ip|latitude|longitude|gps|user_agent'),
  0::bigint, '0011: no column for location, device or IP address');

-- 0012 check_in
select is(has_function_privilege('authenticated', 'public.check_in(uuid)', 'execute') and not has_function_privilege('anon', 'public.check_in(uuid)', 'execute'),
  true, '0012: signed-in users can run check_in and anon cannot');

-- 0013 caregiver_visit_view
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'checklist_items'),
  1::bigint, '0013: the checklist has its one read policy');
select is((select count(*) from pg_views where schemaname = 'public' and viewname = 'caregiver_visit'),
  1::bigint, '0013: the view caregiver_visit exists');
select is(has_table_privilege('authenticated', 'public.caregiver_visit', 'select') and not has_table_privilege('anon', 'public.caregiver_visit', 'select')
      and has_function_privilege('authenticated', 'private.visit_day_state(timestamptz)', 'execute')
      and not has_function_privilege('authenticated', 'private.visit_now()', 'execute'),
  true, '0013: signed-in users read the view; the clock stays closed');

-- 0014 visit_task_views
select is((select count(*) from pg_views where (schemaname, viewname) in (('public', 'caregiver_visit_tasks'), ('private', 'visit_task_latest'))),
  2::bigint, '0014: the two task views exist');
select is(has_table_privilege('authenticated', 'public.caregiver_visit_tasks', 'select') and not has_table_privilege('anon', 'public.caregiver_visit_tasks', 'select')
      and not has_table_privilege('authenticated', 'private.visit_task_latest', 'select'),
  true, '0014: signed-in users read caregiver_visit_tasks; the private view is closed');

-- 0015 log_visit_task
select is(has_function_privilege('authenticated', 'public.log_visit_task(uuid, text, text, text)', 'execute')
      and not has_function_privilege('anon', 'public.log_visit_task(uuid, text, text, text)', 'execute'),
  true, '0015: signed-in users can run log_visit_task and anon cannot');
select is((select count(*) from public.checklist_items where bundle_code = 'doctors_day_out' and name = 'Post-visit summary')
        + (select count(*) from public.checklist_items where name = 'Post-visit report'),
  1::bigint, '0015: the Doctor''s Day Out task is called Post-visit summary and nothing is still called Post-visit report');

-- 0016 check_out
select is(has_function_privilege('authenticated', 'public.check_out(uuid, text)', 'execute')
      and not has_function_privilege('anon', 'public.check_out(uuid, text)', 'execute'),
  true, '0016: signed-in users can run check_out and anon cannot');

-- 0017 test_clock_per_caregiver
select is((select count(*) from information_schema.columns
            where table_schema = 'private' and table_name = 'test_clock' and column_name in ('caregiver_id', 'at')),
  2::bigint, '0017: the test clock has a caregiver and a moment');
select is(not has_table_privilege('authenticated', 'private.test_clock', 'select') and not has_table_privilege('anon', 'private.test_clock', 'select')
      and not has_function_privilege('authenticated', 'private.visit_now()', 'execute'),
  true, '0017: the API roles cannot read or use the test clock');

-- the whole database, after all of them
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint, 'every public table has row-level security on');

-- ---------------------------------------------------------------------------
-- The production checks (addendum part 2)
-- ---------------------------------------------------------------------------
select is((select count(*) from private.test_clock), 0::bigint, 'production check: the test clock has zero rows');
select is((select count(*) from public.checklist_items), 7::bigint, 'production check: the 7 checklist rows are present');
select is((select count(*) from public.checklist_items where bundle_code = 'medicheck'), 3::bigint, 'production check: 3 for MediCheck');
select is((select count(*) from public.checklist_items where bundle_code = 'doctors_day_out'), 4::bigint, 'production check: 4 for Doctor''s Day Out');

-- the probe query (addendum part 2), exactly as written there
create temp table probe_result as
with
  b as (select id, status::text as status, bundle_code, assigned_caregiver_id from public.bookings),
  v as (select id, booking_id, caregiver_id, checked_in_at, checked_out_at from public.visits),
  t as (select id, visit_id, checklist_item_id, required, note_required from public.visit_tasks),
  e as (select id, visit_task_id, outcome::text as outcome, note, reason, logged_at from public.visit_task_entries)
select 'BOOKING_WITHOUT_VISIT' as kind, b.id::text as ref
  from b where b.status in ('in_progress', 'completed') and not exists (select 1 from v where v.booking_id = b.id)
union all
select 'STATUS_MISMATCH', v.id::text
  from v join b on b.id = v.booking_id
 where b.status <> case when v.checked_out_at is null then 'in_progress' else 'completed' end
union all
select 'WRONG_CAREGIVER', v.id::text
  from v join b on b.id = v.booking_id where b.assigned_caregiver_id is distinct from v.caregiver_id
union all
select 'CLOSED_BEFORE_OPEN', v.id::text from v where v.checked_out_at < v.checked_in_at
union all
select 'TWO_OPEN_VISITS', v.caregiver_id::text from v where v.checked_out_at is null group by v.caregiver_id having count(*) > 1
union all
select 'SNAPSHOT_MISMATCH', v.id::text
  from v join b on b.id = v.booking_id
 where (select coalesce(array_agg(t.checklist_item_id order by t.checklist_item_id), '{}') from t where t.visit_id = v.id)
       is distinct from
       (select coalesce(array_agg(c.id order by c.id), '{}') from public.checklist_items c where c.bundle_code = b.bundle_code)
union all
select 'REQUIRED_TASK_NOT_LOGGED', t.id::text
  from t join v on v.id = t.visit_id
 where v.checked_out_at is not null and t.required and not exists (select 1 from e where e.visit_task_id = t.id)
union all
select 'ENTRY_OUTSIDE_VISIT', e.id::text
  from e join t on t.id = e.visit_task_id join v on v.id = t.visit_id
 where e.logged_at < v.checked_in_at or (v.checked_out_at is not null and e.logged_at > v.checked_out_at)
union all
select 'ENTRY_WITHOUT_TEXT', e.id::text
  from e join t on t.id = e.visit_task_id
 where (e.outcome = 'not_done' and e.reason is null) or (e.outcome = 'done' and t.note_required and e.note is null);
select is((select count(*) from probe_result), 0::bigint, 'production check: the probe returns nothing on an empty database');
drop table probe_result;

-- ---------------------------------------------------------------------------
-- Data for the next checks: ad Admin, cg a Verified caregiver, fm a family member
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'fm@t.test', '{"full_name":"Family"}', '{}');
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c1', 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad');
insert into public.care_recipients (id, account_id, name)
values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Mzee Test');

-- a booking in progress with no visit, and one assigned with an open visit: two offenders
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status, assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(), 'in_progress',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', now(), 'assigned',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now());
insert into public.visits (id, booking_id, caregiver_id, checked_in_at)
values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000c1', now());
insert into public.visit_tasks (visit_id, checklist_item_id, sort_order, name, required, note_required)
select '00000000-0000-0000-0000-0000000000a2', id, sort_order, name, required, note_required from public.checklist_items where bundle_code = 'medicheck';

create temp table probe_result2 as
with
  b as (select id, status::text as status, bundle_code, assigned_caregiver_id from public.bookings),
  v as (select id, booking_id, caregiver_id, checked_in_at, checked_out_at from public.visits)
select 'BOOKING_WITHOUT_VISIT' as kind, b.id::text as ref
  from b where b.status in ('in_progress', 'completed') and not exists (select 1 from v where v.booking_id = b.id)
union all
select 'STATUS_MISMATCH', v.id::text
  from v join b on b.id = v.booking_id
 where b.status <> case when v.checked_out_at is null then 'in_progress' else 'completed' end;
select is((select count(*) from probe_result2 where kind = 'BOOKING_WITHOUT_VISIT' and ref = '00000000-0000-0000-0000-00000000b001'), 1::bigint,
  'the probe finds a booking in progress with no visit');
select is((select count(*) from probe_result2 where kind = 'STATUS_MISMATCH' and ref = '00000000-0000-0000-0000-0000000000a2'), 1::bigint,
  'the probe finds an open visit whose booking is not in progress');
drop table probe_result2;

-- ---------------------------------------------------------------------------
-- No test rows (addendum part 4): the query, and that it finds one
-- ---------------------------------------------------------------------------
create temp table test_rows as
select 'profile' as kind, p.email as ref from public.profiles p
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'care_recipient', r.name from public.care_recipients r join public.profiles p on p.id = r.account_id
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'booking', b.id::text from public.bookings b join public.profiles p on p.id = b.account_id
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'visit', v.id::text from public.visits v join public.bookings b on b.id = v.booking_id join public.profiles p on p.id = b.account_id
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'test_clock', c.caregiver_id::text from private.test_clock c;
select is((select count(*) from test_rows), 0::bigint, 'the test-rows query finds nothing in these data (their addresses are not test addresses)');
drop table test_rows;
update public.profiles set email = 'e2e-1@test.vizazicare.example' where id = '00000000-0000-0000-0000-0000000000f1';
select is((select count(*) from public.profiles p where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'), 1::bigint,
  'the test-rows query finds a test address');
update public.profiles set email = 'fm@t.test' where id = '00000000-0000-0000-0000-0000000000f1';

-- ---------------------------------------------------------------------------
-- The hand-correction procedure (addendum part 3), as written there
-- ---------------------------------------------------------------------------

-- Case 1: a stuck open visit. b002 / a2 is open, with its Required tasks not logged.
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_at)
select t.id, 'not_done', 'Closed by the Tech Lead on 2026-11-05: the Caregiver could not log it (test)', clock_timestamp()
  from public.visit_tasks t
 where t.visit_id = '00000000-0000-0000-0000-0000000000a2' and t.required
   and not exists (select 1 from public.visit_task_entries e where e.visit_task_id = t.id);
update public.visits set checked_out_at = clock_timestamp(), visit_note = 'Closed by the Tech Lead on 2026-11-05: the Caregiver could not log it (test)'
 where id = '00000000-0000-0000-0000-0000000000a2' and checked_out_at is null;
update public.bookings set status = 'completed' where id = '00000000-0000-0000-0000-00000000b002' and status in ('assigned', 'in_progress');
select is((select checked_out_at is not null and visit_note like 'Closed by the Tech Lead%' from public.visits where id = '00000000-0000-0000-0000-0000000000a2'),
  true, 'case 1: the stuck visit is closed with a note that says who and why');
select is((select count(*) from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id
            where t.visit_id = '00000000-0000-0000-0000-0000000000a2' and e.outcome = 'not_done' and e.reason like 'Closed by the Tech Lead%'),
  2::bigint, 'case 1: each Required task has a Not done entry that says who and why');

-- Case 2: a closed visit is refused by its guard, until the guard is switched off for one statement and back on
select throws_ok($$update public.visits set visit_note = 'Corrected' where id = '00000000-0000-0000-0000-0000000000a2'$$, 'P0001', 'VISIT_CLOSED',
  'case 2: a closed visit cannot be updated while its guard is on');
alter table public.visits disable trigger visits_guard;
update public.visits
   set visit_note = coalesce(visit_note || E'\n', '') || 'Corrected by the Tech Lead on 2026-11-06: typo (test)'
 where id = '00000000-0000-0000-0000-0000000000a2';
alter table public.visits enable trigger visits_guard;
select is((select tgenabled from pg_trigger where tgname = 'visits_guard' and tgrelid = 'public.visits'::regclass), 'O'::"char", 'case 2: the guard is back on');
select is((select visit_note like 'Closed by the Tech Lead%' and visit_note like '%Corrected by the Tech Lead on 2026-11-06%' from public.visits where id = '00000000-0000-0000-0000-0000000000a2'),
  true, 'case 2: the correction is added to the visit note, and what was there stays');
select throws_ok($$update public.visits set visit_note = 'Again' where id = '00000000-0000-0000-0000-0000000000a2'$$, 'P0001', 'VISIT_CLOSED',
  'case 2: and the guard refuses again');

-- Case 3: a wrong entry on a closed visit is corrected by APPENDING one (never by editing), inside the visit
alter table public.visit_task_entries disable trigger visit_task_entries_open_visit_only;
insert into public.visit_task_entries (visit_task_id, outcome, note, logged_at)
select e.visit_task_id, 'done', 'Corrected by the Tech Lead on 2026-11-06: the Caregiver confirmed it was done (test)', v.checked_out_at
  from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id join public.visits v on v.id = t.visit_id
 where v.id = '00000000-0000-0000-0000-0000000000a2' and t.name = 'Medication assistance' and e.outcome = 'not_done';
alter table public.visit_task_entries enable trigger visit_task_entries_open_visit_only;
select is((select tgenabled from pg_trigger where tgname = 'visit_task_entries_open_visit_only' and tgrelid = 'public.visit_task_entries'::regclass), 'O'::"char",
  'case 3: the entry guard is back on');
select is((select outcome::text from private.visit_task_latest l join public.visit_tasks t on t.id = l.visit_task_id
            where t.visit_id = '00000000-0000-0000-0000-0000000000a2' and t.name = 'Medication assistance'), 'done',
  'case 3: the appended entry is the one that counts');
select is((select count(*) from public.visit_task_entries e join public.visit_tasks t on t.id = e.visit_task_id
            where t.visit_id = '00000000-0000-0000-0000-0000000000a2' and t.name = 'Medication assistance'), 2::bigint,
  'case 3: the earlier entry is still there');
select throws_ok($$insert into public.visit_task_entries (visit_task_id, outcome, logged_at)
                   select id, 'done', now() from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000a2' limit 1$$, 'P0001', 'VISIT_CLOSED',
  'case 3: and nothing can be added to a closed visit again');

select * from finish();
rollback;
