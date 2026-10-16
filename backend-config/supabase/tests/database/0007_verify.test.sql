-- Tests for migration 0007 (DEV-031, verify_caregiver / remove_caregiver_verification).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ad = Admin, cg and cg2 = caregivers, fm = family member.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@t.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000cc', 'cg@t.test', '{"full_name":"Caregiver One"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'cg2@t.test', '{"full_name":"Caregiver Two"}', '{"role":"caregiver"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'fm@t.test', '{"full_name":"Family"}', '{}');

set local role authenticated;

-- Not an Admin: refused before anything else is looked at ----------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', 'note')$$,
  '42501', 'NOT_ADMIN', 'a family member cannot verify');
select throws_ok($$select public.remove_caregiver_verification('00000000-0000-0000-0000-0000000000cc', 'note')$$,
  '42501', 'NOT_ADMIN', 'a family member cannot remove a verification');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated"}', true);
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', 'note')$$,
  '42501', 'NOT_ADMIN', 'a caregiver cannot verify themselves');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', 'note')$$,
  '42501', 'NOT_ADMIN', 'a call with no signed-in user is refused');

-- Execute rights: signed-in users only ------------------------------------------
select is(has_function_privilege('anon', 'public.verify_caregiver(uuid, text)', 'execute'), false,
  'anon cannot run verify_caregiver');
select is(has_function_privilege('anon', 'public.remove_caregiver_verification(uuid, text)', 'execute'), false,
  'anon cannot run remove_caregiver_verification');
select is(has_function_privilege('authenticated', 'public.verify_caregiver(uuid, text)', 'execute'), true,
  'signed-in users can run verify_caregiver');
select is(has_function_privilege('authenticated', 'public.remove_caregiver_verification(uuid, text)', 'execute'), true,
  'signed-in users can run remove_caregiver_verification');

-- Admin ------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', '   ')$$,
  'P0001', 'NOTE_REQUIRED', 'a blank note is refused');
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', null)$$,
  'P0001', 'NOTE_REQUIRED', 'a missing note is refused');
select throws_ok(format($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', %L)$$, repeat('x', 1001)),
  'P0001', 'NOTE_TOO_LONG', 'a note over 1000 characters is refused');
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000f1', 'note')$$,
  'P0001', 'CAREGIVER_NOT_FOUND', 'a family member cannot be verified');
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-00000000dead', 'note')$$,
  'P0001', 'CAREGIVER_NOT_FOUND', 'an unknown id is refused');
select throws_ok($$select public.remove_caregiver_verification('00000000-0000-0000-0000-0000000000c2', 'note')$$,
  'P0001', 'NOT_VERIFIED', 'removing a caregiver who was never verified is refused');

select lives_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', '  Met in person  ')$$,
  'an Admin can verify a caregiver');
select throws_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', 'again')$$,
  'P0001', 'ALREADY_VERIFIED', 'verifying twice is refused');
select lives_ok($$select public.remove_caregiver_verification('00000000-0000-0000-0000-0000000000cc', 'Reference failed')$$,
  'an Admin can remove a verification');
select throws_ok($$select public.remove_caregiver_verification('00000000-0000-0000-0000-0000000000cc', 'again')$$,
  'P0001', 'NOT_VERIFIED', 'removing twice is refused');
select lives_ok($$select public.verify_caregiver('00000000-0000-0000-0000-0000000000cc', 'Re-checked')$$,
  'a removed caregiver can be verified again');

reset role;

-- What was written ---------------------------------------------------------------
select is((select count(*)::int from public.caregiver_verifications
            where caregiver_id = '00000000-0000-0000-0000-0000000000cc'),
  3, 'one history row per successful call');
select is((select string_agg(action::text, ',' order by created_at) from public.caregiver_verifications
            where caregiver_id = '00000000-0000-0000-0000-0000000000cc'),
  'verified,removed,verified', 'the history is in call order');
select is((select count(*)::int from public.caregiver_verifications
            where acted_by <> '00000000-0000-0000-0000-0000000000ad'),
  0, 'acted_by is the Admin who made the call');
select is(private.is_verified('00000000-0000-0000-0000-0000000000cc'), true,
  'the caregiver ends up verified');
select is(private.is_verified('00000000-0000-0000-0000-0000000000c2'), false,
  'the other caregiver is untouched');
select is((select note from public.caregiver_verifications
            where action = 'verified' order by created_at limit 1),
  'Met in person', 'notes are stored without surrounding spaces');
select matches(pg_get_functiondef('public.verify_caregiver(uuid, text)'::regprocedure), 'for update',
  'verify_caregiver locks the caregiver row');
select matches(pg_get_functiondef('public.remove_caregiver_verification(uuid, text)'::regprocedure), 'for update',
  'remove_caregiver_verification locks the caregiver row');
select is((select count(*)::int from public.caregiver_verifications
            where caregiver_id = '00000000-0000-0000-0000-0000000000c2'),
  0, 'failed calls wrote nothing');

select * from finish();
rollback;
