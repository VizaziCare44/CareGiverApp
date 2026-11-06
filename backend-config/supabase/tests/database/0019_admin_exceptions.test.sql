-- Tests for migration 0021 (DEV-079): private.exception_settings and public.admin_exceptions (FD-ADMINEXC
-- §3, §5, §9). The persona-level cases (every exception, every edge, the test clock) are in
-- tests/e2e/admin-exceptions-view.spec.ts; these check the structure, the grants and the boundaries on the
-- database itself.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- the fixed "now" of the Admin in these tests: 2030-01-15 12:00 UTC (15:00 in Nairobi)
-- ad Admin; fm a family; c1 Verified (assigned bookings, closed visits); c2, c3 Verified (open visits);
-- c4 not Verified (open visit); c5 Verified (a booking in progress with no visit row)
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'fm@t.test', '{"full_name":"Family"}', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@t.test', '{"full_name":"Caregiver Three"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@t.test', '{"full_name":"Caregiver Four"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c5', 'c5@t.test', '{"full_name":"Caregiver Five"}', '{"role":"caregiver"}');
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
select c, 'verified', 'ok', '00000000-0000-0000-0000-0000000000ad'
  from unnest(array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3',
                    '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c5']::uuid[]) as c;
insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
values ('00000000-0000-0000-0000-0000000000c4', 'removed', 'gone', '00000000-0000-0000-0000-0000000000ad');
insert into public.care_recipients (id, account_id, name)
values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-0000000000f1', 'Mzee Test');
insert into private.test_clock (caregiver_id, now_override) values ('00000000-0000-0000-0000-0000000000ad', '2030-01-15 12:00:00+00');

-- The structure, the settings and the grants -------------------------------------------------------
select is((select string_agg(key || '=' || value, ',' order by key) from private.exception_settings),
  'in_progress_hours=8,on_time_minutes=30,window_days=7', 'the three settings, with the founder''s figures (30 minutes, DEC-3 = 8 hours, DEC-4 = 7 days)');
select ok(not has_table_privilege('authenticated', 'private.exception_settings', 'select') and not has_table_privilege('anon', 'private.exception_settings', 'select')
      and not has_table_privilege('authenticated', 'private.exception_settings', 'update'),
  'no API role can read or write the settings');
select ok(has_function_privilege('authenticated', 'private.exceptions_now()', 'execute') and not has_function_privilege('anon', 'private.exceptions_now()', 'execute')
      and not has_function_privilege('authenticated', 'private.visit_now()', 'execute'),
  'the view reads "now" through a wrapper signed-in users may run, and visit_now itself stays closed (TC-VIS-045)');
select throws_ok($$insert into private.exception_settings (key, value) values ('something_else', 1)$$, '23514', null, 'only the three keys exist');
select throws_ok($$update private.exception_settings set value = 0 where key = 'window_days'$$, '23514', null, 'a setting must be positive');
select is((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'admin_exceptions'),
  'booking_id,requested_datetime,bundle_code,recipient_name,caregiver_name,status,e1_no_check_in,e2_late_check_in,e3_check_out_outstanding,e4_required_task_not_done,e5_caregiver_not_verified,e6_visit_record_missing,minutes_since_requested,minutes_late,minutes_since_check_in,not_done_tasks',
  'the sixteen columns of FD-ADMINEXC §9, in order');
select ok(has_table_privilege('authenticated', 'public.admin_exceptions', 'select') and not has_table_privilege('anon', 'public.admin_exceptions', 'select'),
  'signed-in users can select the view and anon cannot');
select ok(not has_table_privilege('authenticated', 'public.admin_exceptions', 'insert') and not has_table_privilege('authenticated', 'public.admin_exceptions', 'update')
      and not has_table_privilege('authenticated', 'public.admin_exceptions', 'delete'),
  'no role can write the view (AC-010)');
select is((select reloptions::text from pg_class where relname = 'admin_exceptions' and relnamespace = 'public'::regnamespace), '{security_barrier=true}', 'security_barrier is on');
select is((select definition ~ '\m(30|8|7)\M' from pg_views where schemaname = 'public' and viewname = 'admin_exceptions'), false,
  'none of the three figures is written as a number in the view (AC-020)');
select is((select definition ilike '%admin_booking_overview%' from pg_views where schemaname = 'public' and viewname = 'admin_exceptions'), true, 'it is composed on admin_booking_overview');
select is((select count(*) from pg_views where schemaname = 'public' and viewname = 'admin_exceptions' and (definition ilike '%care_notes%' or definition ilike '%phone%' or definition ilike '%visit_note%' or definition ilike '%.note%')),
  0::bigint, 'the view reads no note, no visit note, no care notes and no phone number (R-06)');

-- Data: one booking for each boundary ----------------------------------------------------------------
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status, assigned_caregiver_id, assigned_by, assigned_at)
select id, '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', requested::timestamptz, status::public.booking_status, cg::uuid,
       '00000000-0000-0000-0000-0000000000ad', '2030-01-01'
  from (values
    ('00000000-0000-0000-0000-00000000e101'::uuid, '2030-01-15 11:29:00+00', 'assigned',    '00000000-0000-0000-0000-0000000000c1'), -- 31 minutes before now: E1
    ('00000000-0000-0000-0000-00000000e102'::uuid, '2030-01-15 11:30:00+00', 'assigned',    '00000000-0000-0000-0000-0000000000c1'), -- exactly 30: not shown
    ('00000000-0000-0000-0000-00000000e103'::uuid, '2030-01-15 11:29:59+00', 'assigned',    '00000000-0000-0000-0000-0000000000c1'), -- 30:01: E1, reads 30
    ('00000000-0000-0000-0000-00000000e104'::uuid, '2030-01-15 13:00:00+00', 'assigned',    '00000000-0000-0000-0000-0000000000c1'), -- still ahead: never shown
    ('00000000-0000-0000-0000-00000000e105'::uuid, '2030-01-07 09:00:00+00', 'assigned',    '00000000-0000-0000-0000-0000000000c1'), -- 7 Jan: before the window (8 Jan in Nairobi is the first day)
    ('00000000-0000-0000-0000-00000000e106'::uuid, '2030-01-08 06:00:00+00', 'assigned',    '00000000-0000-0000-0000-0000000000c1'), -- 09:00 on 8 Jan: the first day inside the window
    ('00000000-0000-0000-0000-00000000e107'::uuid, '2030-01-15 06:00:00+00', 'completed',   '00000000-0000-0000-0000-0000000000c1'), -- completed, no visit row: E6
    ('00000000-0000-0000-0000-00000000e108'::uuid, '2030-01-15 06:00:00+00', 'in_progress', '00000000-0000-0000-0000-0000000000c5'), -- in progress, no visit row: E6
    ('00000000-0000-0000-0000-00000000e109'::uuid, '2030-01-15 09:00:00+00', 'completed',   '00000000-0000-0000-0000-0000000000c1'), -- closed visit, check-in 31 minutes late: E2
    ('00000000-0000-0000-0000-00000000e10a'::uuid, '2030-01-15 09:00:00+00', 'completed',   '00000000-0000-0000-0000-0000000000c1'), -- closed visit, check-in exactly 30 after: not E2
    ('00000000-0000-0000-0000-00000000e10b'::uuid, '2030-01-15 03:50:00+00', 'in_progress', '00000000-0000-0000-0000-0000000000c2'), -- open, checked in exactly 8 hours ago: not E3
    ('00000000-0000-0000-0000-00000000e10c'::uuid, '2030-01-15 03:49:00+00', 'in_progress', '00000000-0000-0000-0000-0000000000c3'), -- open, checked in 8 hours and a minute ago: E3
    ('00000000-0000-0000-0000-00000000e10d'::uuid, '2030-01-15 09:00:00+00', 'in_progress', '00000000-0000-0000-0000-0000000000c4'), -- open, caregiver no longer Verified: E5
    ('00000000-0000-0000-0000-00000000e10e'::uuid, '2030-01-14 09:00:00+00', 'completed',   '00000000-0000-0000-0000-0000000000c1'), -- closed, Required task Not done: E4
    ('00000000-0000-0000-0000-00000000e10f'::uuid, '2030-01-14 09:00:00+00', 'completed',   '00000000-0000-0000-0000-0000000000c1'), -- closed, Not done corrected to Done: nothing
    ('00000000-0000-0000-0000-00000000e110'::uuid, '2030-01-14 09:00:00+00', 'completed',   '00000000-0000-0000-0000-0000000000c1')  -- closed, an Optional task Not done: nothing
  ) as t(id, requested, status, cg);
-- a requested and a cancelled booking never appear
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status)
values ('00000000-0000-0000-0000-00000000e111', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', '2030-01-14 09:00:00+00', 'requested'),
       ('00000000-0000-0000-0000-00000000e112', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1', 'medicheck', '2030-01-14 09:00:00+00', 'cancelled');

-- the visits (opened, given their tasks and entries, then closed where they are closed)
insert into public.visits (id, booking_id, caregiver_id, checked_in_at, checked_out_at) values
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-00000000e109', '00000000-0000-0000-0000-0000000000c1', '2030-01-15 09:31:00+00', '2030-01-15 10:00:00+00'),
  ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000e10a', '00000000-0000-0000-0000-0000000000c1', '2030-01-15 09:30:00+00', '2030-01-15 10:00:00+00'),
  ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-00000000e10b', '00000000-0000-0000-0000-0000000000c2', '2030-01-15 04:00:00+00', null),
  ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-00000000e10c', '00000000-0000-0000-0000-0000000000c3', '2030-01-15 03:59:00+00', null),
  ('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-00000000e10d', '00000000-0000-0000-0000-0000000000c4', '2030-01-15 09:05:00+00', null);
-- E4 cases: opened with c1 one after another (a caregiver has one open visit at a time), their entries, then closed
insert into public.visits (id, booking_id, caregiver_id, checked_in_at) values ('00000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-00000000e10e', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:05:00+00');
insert into public.visit_tasks (visit_id, task_key, name, sort_order, is_required, note_required_for_done)
select '00000000-0000-0000-0000-0000000000ae', task_key, name, sort_order, is_required, note_required_for_done from public.checklist_items where bundle_code = 'medicheck';
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
select id, 'not_done', 'Recipient takes no medicines', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:30:00+00' from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000ae' and task_key = 'medication_assistance';
insert into public.visit_task_entries (visit_task_id, outcome, note, logged_by, logged_at)
select id, 'done', 'secret-reading', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:40:00+00' from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000ae' and task_key = 'vitals_check';
update public.visits set checked_out_at = '2030-01-14 11:00:00+00', visit_note = 'secret-visit-note' where id = '00000000-0000-0000-0000-0000000000ae';

insert into public.visits (id, booking_id, caregiver_id, checked_in_at) values ('00000000-0000-0000-0000-0000000000af', '00000000-0000-0000-0000-00000000e10f', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:05:00+00');
insert into public.visit_tasks (visit_id, task_key, name, sort_order, is_required, note_required_for_done)
select '00000000-0000-0000-0000-0000000000af', task_key, name, sort_order, is_required, note_required_for_done from public.checklist_items where bundle_code = 'medicheck';
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
select id, 'not_done', 'First thought', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:30:00+00' from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000af' and task_key = 'medication_assistance';
insert into public.visit_task_entries (visit_task_id, outcome, logged_by, logged_at)
select id, 'done', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:35:00+00' from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000af' and task_key = 'medication_assistance';
update public.visits set checked_out_at = '2030-01-14 11:00:00+00' where id = '00000000-0000-0000-0000-0000000000af';

insert into public.visits (id, booking_id, caregiver_id, checked_in_at) values ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000e110', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:05:00+00');
insert into public.visit_tasks (visit_id, task_key, name, sort_order, is_required, note_required_for_done)
select '00000000-0000-0000-0000-0000000000b0', task_key, name, sort_order, is_required, note_required_for_done from public.checklist_items where bundle_code = 'medicheck';
insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
select id, 'not_done', 'She was resting', '00000000-0000-0000-0000-0000000000c1', '2030-01-14 09:30:00+00' from public.visit_tasks where visit_id = '00000000-0000-0000-0000-0000000000b0' and task_key = 'companionship';
update public.visits set checked_out_at = '2030-01-14 11:00:00+00' where id = '00000000-0000-0000-0000-0000000000b0';

-- the Admin's list, read once with the Admin's claims (as the database owner, so the table can be made), then the
-- same list is read below as each role
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
create temp table seen as select * from public.admin_exceptions;
grant select on seen to authenticated;

-- Who can read -------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.admin_exceptions$$, '42501', null, 'anon is refused (AC-001)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*) from public.admin_exceptions), 0::bigint, 'a family member gets an empty list (AC-001)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*) from public.admin_exceptions), 0::bigint, 'a caregiver gets an empty list (AC-001)');

-- The Admin: every exception and every edge ----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*) from public.admin_exceptions), (select count(*) from seen), 'the Admin reads the same list as the database owner does with the Admin''s claims');

select is((select count(*) from seen where e1_no_check_in), 3::bigint, 'E1: 31 minutes, 30:01 and the booking on the first day of the window (and not exactly 30, not ahead, not before the window)');
select is((select minutes_since_requested from seen where booking_id = '00000000-0000-0000-0000-00000000e101'), 31, 'E1 at 31 minutes reads 31');
select is((select minutes_since_requested from seen where booking_id = '00000000-0000-0000-0000-00000000e103'), 30, 'E1 at 30:01 shows the row and reads 30: whole minutes rounded down (R-14)');
select is((select count(*) from seen where booking_id = '00000000-0000-0000-0000-00000000e102'), 0::bigint, 'exactly 30 minutes: no row (AC-002)');
select is((select count(*) from seen where booking_id = '00000000-0000-0000-0000-00000000e104'), 0::bigint, 'a booking whose time is still ahead never appears (AC-021)');
select is((select count(*) from seen where booking_id = '00000000-0000-0000-0000-00000000e105'), 0::bigint, 'a booking before the window is not shown (AC-008)');
select is((select count(*) from seen where booking_id = '00000000-0000-0000-0000-00000000e106'), 1::bigint, 'and the first day of the window is (the Nairobi day, not the UTC day)');
select is((select count(*) from seen where booking_id in ('00000000-0000-0000-0000-00000000e111', '00000000-0000-0000-0000-00000000e112')), 0::bigint, 'a requested and a cancelled booking never appear (AC-008)');

select is((select e2_late_check_in from seen where booking_id = '00000000-0000-0000-0000-00000000e109'), true, 'E2: checked in 31 minutes after the requested time');
select is((select minutes_late from seen where booking_id = '00000000-0000-0000-0000-00000000e109'), 31, 'reads 31');
select is((select count(*) from seen where booking_id = '00000000-0000-0000-0000-00000000e10a'), 0::bigint, 'checked in exactly 30 minutes after: on time, no row (AC-003)');
select is((select count(*) from seen where e1_no_check_in and e2_late_check_in), 0::bigint, 'E1 and E2 are never together (AC-018)');

select is((select count(*) from seen where booking_id = '00000000-0000-0000-0000-00000000e10b'), 0::bigint, 'E3: an open visit checked in exactly 8 hours ago: no row (AC-004)');
select is((select minutes_since_check_in from seen where booking_id = '00000000-0000-0000-0000-00000000e10c' and e3_check_out_outstanding), 481, 'checked in 8 hours and a minute ago: E3, reads 481');

select is((select e5_caregiver_not_verified from seen where booking_id = '00000000-0000-0000-0000-00000000e10d'), true, 'E5: in progress and the caregiver is no longer Verified, from the check-in (AC-006, AC-021)');
select is((select count(*) from seen where e5_caregiver_not_verified), 1::bigint, 'and only that one');

select is((select e4_required_task_not_done from seen where booking_id = '00000000-0000-0000-0000-00000000e10e'), true, 'E4: a closed visit with a Required task whose latest entry is Not done');
select is((select not_done_tasks::text from seen where booking_id = '00000000-0000-0000-0000-00000000e10e'), '[{"name": "Medication assistance", "reason": "Recipient takes no medicines"}]',
  'with the task name and its reason, and nothing else (AC-005, AC-014)');
select is((select count(*) from seen where booking_id in ('00000000-0000-0000-0000-00000000e10f', '00000000-0000-0000-0000-00000000e110')), 0::bigint,
  'corrected to Done, or an Optional task Not done: no row (AC-005)');
select is((select position('secret' in (select string_agg(s::text, '') from seen s))), 0, 'no note and no visit note appear anywhere in the list (AC-014)');

select is((select count(*) from seen where e6_visit_record_missing), 2::bigint, 'E6: a completed and an in-progress booking with no visit row (AC-007)');
select is((select count(*) from seen where e6_visit_record_missing and status in ('completed', 'in_progress')), 2::bigint, 'with their status');

select is((select count(*) from seen where not (e1_no_check_in or e2_late_check_in or e3_check_out_outstanding or e4_required_task_not_done or e5_caregiver_not_verified or e6_visit_record_missing)),
  0::bigint, 'every row has at least one exception');
select is((select count(*) from (select booking_id from seen group by booking_id having count(*) > 1) d), 0::bigint, 'one row per booking (R-03)');
select is((select string_agg(booking_id::text, ',' order by requested_datetime, booking_id) from seen) , (select string_agg(booking_id::text, ',') from seen),
  'the rows come ordered by requested time, then booking id (R-04)');

-- Moving a setting moves its boundary, with no change to the view (AC-020)
reset role;
update private.exception_settings set value = 45 where key = 'on_time_minutes';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*) from public.admin_exceptions where booking_id = '00000000-0000-0000-0000-00000000e101'), 0::bigint, 'with on_time_minutes at 45, the 31-minute booking is no longer an exception');
reset role;
update private.exception_settings set value = 3 where key = 'window_days';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*) from public.admin_exceptions where booking_id = '00000000-0000-0000-0000-00000000e106'), 0::bigint, 'with window_days at 3, the booking of 8 January falls outside the window');
reset role;
update private.exception_settings set value = 30 where key = 'on_time_minutes';
update private.exception_settings set value = 7 where key = 'window_days';

select * from finish();
rollback;
