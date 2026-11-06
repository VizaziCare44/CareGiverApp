-- Tests for the visit schema, check_in and caregiver_visit as FD-VISIT section 7.2 to 7.4 define them
-- (migrations 0011 to 0013, rebuilt in the spec's shape by 0020).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ad = Admin; c1, c2 verified caregivers; c3 an unverified caregiver; fm a family member.
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

-- All assigned. bT, bT2: the visit is today (Nairobi) with c1; bF: in two days; bP: two days ago;
-- bO: today, but c2's; bX: today, c1's, cancelled.
insert into public.bookings (id, account_id, care_recipient_id, bundle_code, requested_datetime, status,
                             assigned_caregiver_id, assigned_by, assigned_at) values
  ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now(), 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'doctors_day_out', now(), 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() + interval '2 days', 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a4', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now() - interval '2 days', 'assigned', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ad', now()),
  ('00000000-0000-0000-0000-00000000b0a5', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0f1',
   'medicheck', now(), 'assigned', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000ad', now());

-- The schema (FD-VISIT 7.2) -------------------------------------------------------------------
select is((select count(*) from public.checklist_items), 7::bigint, 'the checklist has seven rows');
select is((select count(*) from public.checklist_items where bundle_code = 'medicheck'), 3::bigint, 'three for MediCheck');
select is((select count(*) from public.checklist_items where bundle_code = 'doctors_day_out'), 4::bigint, 'four for Doctor''s Day Out');
select is((select count(*) from public.checklist_items where name ilike '%administration%' or task_key ilike '%administration%'), 0::bigint,
  'no task is called administration');
select is((select count(*) from public.checklist_items where note_required_for_done), 3::bigint, 'three tasks need a note');
select is((select string_agg(task_key, ',' order by bundle_code, sort_order) from public.checklist_items),
  'pre_visit_preparation,transport_and_escort,advocacy_and_note_taking,post_visit_summary,medication_assistance,vitals_check,companionship',
  'the seven task keys, in screen order');
select is((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
            where table_schema = 'public' and table_name = 'checklist_items'),
  'bundle_code,task_key,name,sort_order,is_required,note_required_for_done', 'the columns of checklist_items');
select is((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
            where table_schema = 'public' and table_name = 'visits'),
  'id,booking_id,caregiver_id,checked_in_at,checked_out_at,visit_note', 'the columns of visits');
select is((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
            where table_schema = 'public' and table_name = 'visit_tasks'),
  'id,visit_id,task_key,name,sort_order,is_required,note_required_for_done', 'the columns of visit_tasks');
select is((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
            where table_schema = 'public' and table_name = 'visit_task_entries'),
  'id,visit_task_id,outcome,note,reason,logged_by,logged_at', 'the columns of visit_task_entries');
select is((select count(*) from information_schema.columns
            where table_schema = 'public' and table_name in ('visits', 'visit_tasks', 'visit_task_entries')
              and (column_name ~* 'location|device|ip_|_ip|latitude|longitude|gps|user_agent')), 0::bigint,
  'no column for location, device or IP address');
select is((select count(*) from private.test_clock), 0::bigint, 'the test clock has no rows');
select is((select count(*) from pg_tables where schemaname = 'public'
            and tablename in ('checklist_items', 'visits', 'visit_tasks', 'visit_task_entries') and rowsecurity),
  4::bigint, 'row-level security is on for the four visit tables');
select ok(not has_table_privilege('anon', 'public.visits', 'select') and not has_table_privilege('anon', 'public.visit_tasks', 'select')
      and not has_table_privilege('anon', 'public.visit_task_entries', 'select') and not has_table_privilege('anon', 'public.checklist_items', 'select'),
  'anon has no access to the visit tables');
select ok(not has_table_privilege('authenticated', 'public.visits', 'insert') and not has_table_privilege('authenticated', 'public.visits', 'update')
      and not has_table_privilege('authenticated', 'public.visits', 'delete')
      and not has_table_privilege('authenticated', 'public.visit_tasks', 'insert')
      and not has_table_privilege('authenticated', 'public.visit_task_entries', 'insert')
      and not has_table_privilege('authenticated', 'public.visit_task_entries', 'update')
      and not has_table_privilege('authenticated', 'public.checklist_items', 'insert'),
  'no API role can write any of the four tables');
select ok(not has_function_privilege('authenticated', 'private.visit_now()', 'execute')
      and not has_function_privilege('anon', 'private.visit_now()', 'execute')
      and not has_table_privilege('authenticated', 'private.test_clock', 'select'),
  'the API roles cannot read or use the test clock');
select is(has_function_privilege('anon', 'public.check_in(uuid)', 'execute'), false, 'anon cannot run check_in');
select is(has_function_privilege('authenticated', 'public.check_in(uuid)', 'execute'), true, 'signed-in users can run check_in');
select is(has_table_privilege('anon', 'public.caregiver_visit', 'select'), false, 'anon cannot read caregiver_visit');
select is((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
            where table_schema = 'public' and table_name = 'caregiver_visit'),
  'booking_id,day_state,checked_in_at,checked_out_at,visit_note,other_visit_booking_id,other_visit_recipient_name,other_visit_bundle_code',
  'the columns of caregiver_visit');

set local role authenticated;

-- Who may check in ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'a family member cannot check in');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'an Admin cannot check in');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, '42501', 'NOT_CAREGIVER', 'a call with no signed-in user is refused');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'BOOKING_NOT_FOUND',
  'a Caregiver who is not Verified gets the same answer as for no booking (nothing leaks)');

-- Which booking and which day --------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000dead')$$, 'P0001', 'BOOKING_NOT_FOUND', 'an unknown booking is refused');
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a5')$$, 'P0001', 'BOOKING_NOT_FOUND', 'another Caregiver''s booking looks the same as an unknown one');
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a3')$$, 'P0001', 'NOT_VISIT_DAY', 'before the day of the visit');
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a4')$$, 'P0001', 'NOT_VISIT_DAY', 'after the day of the visit');

-- What the screen reads before check-in
select is((select count(*) from public.caregiver_visit), 4::bigint, 'c1 reads exactly their four bookings');
select is((select day_state from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), 'today', 'today');
select is((select day_state from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a3'), 'before', 'before');
select is((select day_state from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a4'), 'passed', 'passed');
select is((select checked_in_at from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'), null::timestamptz, 'no visit yet');
select is((select count(*) from public.checklist_items), 7::bigint, 'a Caregiver reads the checklist');

-- Checking in ---------------------------------------------------------------------------
select lives_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'a Verified Caregiver checks in on the day');

select set_config('test.in', (select public.check_in('00000000-0000-0000-0000-00000000b0a1') ->> 'checked_in_at'), true);
select is(public.check_in('00000000-0000-0000-0000-00000000b0a1') ->> 'checked_in_at', current_setting('test.in'),
  'a repeat call gives the same check-in time (a retry)');
select is(public.check_in('00000000-0000-0000-0000-00000000b0a1') ->> 'booking_id', '00000000-0000-0000-0000-00000000b0a1', 'and the booking id');
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a2')$$, 'P0001', 'ANOTHER_VISIT_IN_PROGRESS',
  'a second booking cannot be checked in to while one is open');

select ok((select checked_in_at from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1') is not null, 'the view shows the visit');
select is((select other_visit_booking_id from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a2'),
  '00000000-0000-0000-0000-00000000b0a1'::uuid, 'the second booking sees the visit in progress');
select is((select other_visit_recipient_name from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a2'),
  'Mzee Test', 'with the recipient''s name');
select is((select other_visit_bundle_code::text from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a2'),
  'medicheck', 'and the bundle');
select is((select other_visit_booking_id from public.caregiver_visit where booking_id = '00000000-0000-0000-0000-00000000b0a1'),
  null::uuid, 'the visit in progress has no other visit');

-- Others read nothing of c1's
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit), 1::bigint, 'c2 reads only their own booking');
select is((select other_visit_booking_id from public.caregiver_visit), null::uuid, 'and sees nothing of c1''s visit');
select is((select count(*) from public.visits), 0::bigint, 'c2 reads no visit directly');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit), 0::bigint, 'a family member reads no visits');
select is((select count(*) from public.checklist_items), 0::bigint, 'and no checklist');
select is((select count(*) from public.visits) + (select count(*) from public.visit_tasks) + (select count(*) from public.visit_task_entries), 0::bigint,
  'and none of the visit tables');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select is((select count(*) from public.caregiver_visit), 0::bigint, 'a Caregiver who is not Verified reads no visits');

-- The Admin reads the tables, in full, and writes nothing (FD-VISIT 7.4)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*) from public.visits), 1::bigint, 'the Admin reads the visit');
select is((select count(*) from public.visit_tasks), 3::bigint, 'and its tasks');
select is((select count(*) from public.checklist_items), 7::bigint, 'and the checklist');
select is((select count(*) from public.caregiver_visit), 0::bigint, 'but gets no rows from the Caregiver''s view');
select throws_ok($$delete from public.visits$$, '42501', null, 'the Admin cannot delete a visit');

reset role;

-- What check-in wrote ------------------------------------------------------------------------
select is((select status::text from public.bookings where id = '00000000-0000-0000-0000-00000000b0a1'), 'in_progress', 'the booking is in progress');
select is((select count(*) from public.visits), 1::bigint, 'one visit, not three');
select set_config('test.visit', (select id::text from public.visits), true);
select is((select count(*) from public.visit_tasks where visit_id = current_setting('test.visit')::uuid), 3::bigint,
  'the MediCheck checklist was copied into the visit');
select is((select string_agg(name, ', ' order by sort_order) from public.visit_tasks where visit_id = current_setting('test.visit')::uuid),
  'Medication assistance, Vitals check, Companionship', 'in order');
select is((select string_agg(task_key, ', ' order by sort_order) from public.visit_tasks where visit_id = current_setting('test.visit')::uuid),
  'medication_assistance, vitals_check, companionship', 'with their keys');
select is((select count(*) from public.visit_task_entries), 0::bigint, 'nothing is logged yet');

-- The rules the tables keep ----------------------------------------------------------------------
select throws_ok($$delete from public.visits$$, 'P0001', 'visits is append-only: DELETE is not allowed', 'a visit cannot be deleted');
select throws_ok($$update public.visits set caregiver_id = '00000000-0000-0000-0000-0000000000c2'$$, 'P0001',
  'visits: booking, caregiver and check-in time cannot change', 'who and when cannot change');
select throws_ok($$update public.visit_tasks set name = 'x'$$, 'P0001', 'visit_tasks is append-only: UPDATE is not allowed', 'a task cannot change');
select throws_ok($$delete from public.visit_tasks$$, 'P0001', 'visit_tasks is append-only: DELETE is not allowed', 'a task cannot be deleted');

select throws_ok(format($f$insert into public.visit_task_entries (visit_task_id, outcome, logged_by, logged_at)
  select id, 'not_done', '00000000-0000-0000-0000-0000000000c1', now() from public.visit_tasks where visit_id = %L limit 1$f$, current_setting('test.visit')),
  '23514', null, 'Not done needs a reason');
select throws_ok(format($f$insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
  select id, 'done', 'why', '00000000-0000-0000-0000-0000000000c1', now() from public.visit_tasks where visit_id = %L limit 1$f$, current_setting('test.visit')),
  '23514', null, 'Done stores no reason');
select throws_ok(format($f$insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_at)
  select id, 'not_done', 'Refused', now() from public.visit_tasks where visit_id = %L limit 1$f$, current_setting('test.visit')),
  '23502', null, 'an entry must say who logged it');
select lives_ok(format($f$insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
  select id, 'not_done', 'Refused', '00000000-0000-0000-0000-0000000000c1', now() from public.visit_tasks where visit_id = %L limit 1$f$, current_setting('test.visit')),
  'an entry can be added to an open visit');
select throws_ok($$update public.visit_task_entries set note = 'x'$$, 'P0001', 'visit_task_entries is append-only: UPDATE is not allowed', 'an entry cannot change');

update public.visits set checked_out_at = clock_timestamp() + interval '1 second', visit_note = 'Done'
 where id = current_setting('test.visit')::uuid;
select throws_ok(format($f$insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
  select id, 'not_done', 'Late', '00000000-0000-0000-0000-0000000000c1', now() from public.visit_tasks where visit_id = %L limit 1$f$, current_setting('test.visit')),
  'P0001', 'VISIT_CLOSED', 'nothing is added once the visit is closed');
select throws_ok($$update public.visits set visit_note = 'Changed'$$, 'P0001', 'VISIT_CLOSED', 'a closed visit does not change');

-- check_in on a closed visit
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-00000000b0a1')$$, 'P0001', 'VISIT_ALREADY_CHECKED_OUT',
  'a visit that is checked out cannot be checked in to again');

select * from finish();
rollback;
