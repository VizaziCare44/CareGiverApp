-- Tests for migration 0017 (DEV-070; DRAFT): the test clock is one Caregiver's.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}');

select is((select count(*) from private.test_clock), 0::bigint, 'the test clock has no rows');
select ok(not has_table_privilege('anon', 'private.test_clock', 'select')
      and not has_table_privilege('authenticated', 'private.test_clock', 'select')
      and not has_table_privilege('authenticated', 'private.test_clock', 'insert'),
  'the API roles cannot read or write the test clock');
select ok(not has_function_privilege('authenticated', 'private.visit_now()', 'execute')
      and not has_function_privilege('anon', 'private.visit_now()', 'execute'),
  'the API roles cannot run visit_now');

-- with no row, everyone gets the real time
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(abs(extract(epoch from (private.visit_now() - clock_timestamp()))) < 5, 'with no row, c1 gets the real time');

-- a row is for one Caregiver only
insert into private.test_clock (caregiver_id, at) values ('00000000-0000-0000-0000-0000000000c1', '2030-01-15T06:00:00Z');
select is(private.visit_now(), '2030-01-15T06:00:00Z'::timestamptz, 'c1 gets the moment set for c1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select ok(abs(extract(epoch from (private.visit_now() - clock_timestamp()))) < 5, 'c2 still gets the real time');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select ok(abs(extract(epoch from (private.visit_now() - clock_timestamp()))) < 5, 'a call with no signed-in user gets the real time');

-- one row per Caregiver, and only for a real profile
select throws_ok($$insert into private.test_clock (caregiver_id, at) values ('00000000-0000-0000-0000-0000000000c1', '2031-01-01T00:00:00Z')$$,
  '23505', null, 'a Caregiver has at most one clock row');
select throws_ok($$insert into private.test_clock (caregiver_id, at) values ('00000000-0000-0000-0000-00000000dead', '2031-01-01T00:00:00Z')$$,
  '23503', null, 'a clock row needs a real profile');

select * from finish();
rollback;
