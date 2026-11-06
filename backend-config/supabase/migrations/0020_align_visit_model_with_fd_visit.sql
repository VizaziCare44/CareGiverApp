-- VIZ-91: align the visit model (migrations 0011 to 0019, written while FD-VISIT and FD-FAMVIS were
-- not available) with FD-VISIT section 7.2 to 7.4 and FD-FAMVIS section 7.2 to 7.4, now that
-- both documents are in hand. Checked line by line; the differences were:
--
--   checklist_items   key was a generated id; the spec's key is (bundle_code, task_key). Columns are
--                     is_required and note_required_for_done (draft: required, note_required). Two names
--                     differed: "Transport and escort" (draft "Transport & escort").
--   visit_tasks       id is bigint (draft uuid); copies task_key, is_required, note_required_for_done
--                     (draft: checklist_item_id, required, note_required); UNIQUE (visit_id, task_key).
--   visit_task_entries  visit_task_id is bigint; a logged_by column (draft: none); done stores no reason.
--   visits            created_at removed: the spec lists no such column.
--   test_clock        the moment column is now_override.
--   check_in          a Caregiver who is not Verified, or not the assigned one, gets BOOKING_NOT_FOUND
--                     (draft: CAREGIVER_NOT_VERIFIED, which told them the booking exists); a repeat for a
--                     CLOSED visit is VISIT_ALREADY_CHECKED_OUT (draft: returned the visit); returns
--                     booking_id and checked_in_at.
--   log_visit_task    takes (booking id, task_key, outcome, note, reason) (draft: a task id); unverified,
--                     unassigned or unknown booking is VISIT_NOT_FOUND; a closed visit is
--                     VISIT_ALREADY_CHECKED_OUT (draft: VISIT_CLOSED); over a limit is TEXT_TOO_LONG
--                     (draft: NOTE_TOO_LONG, REASON_TOO_LONG); records logged_by.
--   check_out         unverified, unassigned or unknown booking is VISIT_NOT_FOUND (draft:
--                     CAREGIVER_NOT_VERIFIED, BOOKING_NOT_FOUND); Required tasks are tested before the
--                     note limit; over the limit is TEXT_TOO_LONG (draft: VISIT_NOTE_TOO_LONG); returns
--                     booking_id and checked_out_at.
--   caregiver_visit        exact columns of 7.2 (draft added status and visit_id, and named the other
--                          visit's columns other_booking_id, other_recipient_name, other_bundle_code).
--   caregiver_visit_tasks  exact columns of 7.2 (task_key, is_required, note_required_for_done; no ids).
--   private.visit_task_latest  the five columns of FD-FAMVIS 7.2 (draft added entry_id).
--   family_visit_tasks     one row per task of a completed, closed visit (draft returned no rows at all
--                          when a Required task had no entry).
--   Admin SELECT      on visits, visit_tasks and visit_task_entries, and Admin and Caregiver read of
--                     checklist_items (7.4); the draft did not build the Admin's read.
--
-- Migrations 0011 to 0019 are already applied and are not edited: this is a new migration that
-- rebuilds the visit objects in the spec's shape. It REFUSES TO RUN if any visit exists, because the
-- tables are append-only and rebuilding them would lose records. (Dev held 0 visits on 2026-11-05 and
-- production has none; the tables are empty everywhere this has to run.) The checklist is re-seeded
-- with the spec's seven rows. The test clock keeps its rows.
--
-- Kept as in the draft, recorded in docs/FD-VISIT and FD-FAMVIS Draft Decisions.md:
--   * private.visit_now() reads clock_timestamp(), not now() (the spec says now()), so two calls in one
--     transaction (a test) get two ordered moments; every real call is its own transaction, where the two are
--     the same to the millisecond.
--   * BOOKING_NOT_ASSIGNED for a booking that is not assigned (cancelled, say): the spec does not name the
--     code (TC-VIS-016 asks for it to be recorded), and it is the code change_booking_caregiver uses.
--   * private.visit_day_state(timestamptz) is granted to authenticated, because a function a view calls is
--     checked as the caller. It returns only before, today or passed. For the Tech Lead.

do $$
begin
  if exists (select 1 from public.visits) or exists (select 1 from public.visit_tasks)
     or exists (select 1 from public.visit_task_entries) then
    raise exception '0020 refuses to rebuild the visit tables: they already hold records. Correct by hand instead.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Take down what is rebuilt, in dependency order
-- ---------------------------------------------------------------------------
drop view public.family_visit_tasks;
drop view public.family_visit;
drop view public.caregiver_visit_tasks;
drop view public.caregiver_visit;
drop view private.visit_task_latest;

drop function public.check_in(uuid);
drop function public.log_visit_task(uuid, text, text, text);
drop function public.check_out(uuid, text);

drop table public.visit_task_entries;
drop table public.visit_tasks;
drop policy "checklist_items: caregivers and admins read" on public.checklist_items;
drop table public.checklist_items;

alter table public.visits drop column created_at;

alter table private.test_clock rename column "at" to now_override;

create or replace function private.visit_now()
returns timestamptz
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select c.now_override from private.test_clock c where c.caregiver_id = auth.uid()),
    clock_timestamp()
  );
$$;

revoke all on function private.visit_now() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- checklist_items (FD-VISIT 7.2): reference data, the seven rows in screen order
-- ---------------------------------------------------------------------------
create table public.checklist_items (
  bundle_code public.bundle_code not null,
  task_key text not null check (task_key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null check (sort_order > 0),
  is_required boolean not null,
  note_required_for_done boolean not null default false,
  primary key (bundle_code, task_key),
  unique (bundle_code, sort_order),
  unique (bundle_code, name)
);

insert into public.checklist_items (bundle_code, task_key, name, sort_order, is_required, note_required_for_done) values
  ('medicheck', 'medication_assistance', 'Medication assistance', 1, true, false),
  ('medicheck', 'vitals_check', 'Vitals check', 2, true, true),
  ('medicheck', 'companionship', 'Companionship', 3, false, false),
  ('doctors_day_out', 'pre_visit_preparation', 'Pre-visit preparation', 1, false, false),
  ('doctors_day_out', 'transport_and_escort', 'Transport and escort', 2, true, false),
  ('doctors_day_out', 'advocacy_and_note_taking', 'Advocacy and note-taking', 3, true, true),
  ('doctors_day_out', 'post_visit_summary', 'Post-visit summary', 4, true, true);

-- ---------------------------------------------------------------------------
-- visit_tasks: the checklist as it was when the visit started (FD-VISIT 7.2)
-- ---------------------------------------------------------------------------
create table public.visit_tasks (
  id bigint generated always as identity primary key,
  visit_id uuid not null references public.visits (id),
  task_key text not null,
  name text not null,
  sort_order integer not null,
  is_required boolean not null,
  note_required_for_done boolean not null,
  unique (visit_id, task_key)
);

create index visit_tasks_visit_idx on public.visit_tasks (visit_id, sort_order);

-- ---------------------------------------------------------------------------
-- visit_task_entries: every outcome ever logged, append-only (FD-VISIT 7.2)
-- ---------------------------------------------------------------------------
create table public.visit_task_entries (
  id bigint generated always as identity primary key,
  visit_task_id bigint not null references public.visit_tasks (id),
  outcome public.visit_outcome not null,
  note text check (note is null or char_length(btrim(note)) between 1 and 2000),
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 500),
  logged_by uuid not null references public.profiles (id),
  logged_at timestamptz not null,
  -- a task marked Not done must say why; a task marked Done stores no reason
  check (outcome <> 'not_done' or reason is not null),
  check (outcome <> 'done' or reason is null)
);

create index visit_task_entries_task_idx on public.visit_task_entries (visit_task_id, id desc);

-- the rules the tables keep for themselves (they also stop the service role); the guard function
-- private.guard_entry_insert from 0011 is unchanged and is reused
create trigger visit_tasks_append_only
  before update or delete on public.visit_tasks
  for each row execute function private.reject_modification();
create trigger visit_tasks_no_truncate
  before truncate on public.visit_tasks
  for each statement execute function private.reject_modification();

create trigger visit_task_entries_append_only
  before update or delete on public.visit_task_entries
  for each row execute function private.reject_modification();
create trigger visit_task_entries_no_truncate
  before truncate on public.visit_task_entries
  for each statement execute function private.reject_modification();
create trigger visit_task_entries_open_visit_only
  before insert on public.visit_task_entries
  for each row execute function private.guard_entry_insert();

-- ---------------------------------------------------------------------------
-- Access (FD-VISIT 7.4): the Admin reads the three visit tables (SELECT only; the rows come
-- through a policy on the Admin role); Caregivers and the Admin read checklist_items; nobody
-- else reads, and nobody writes except through the three functions.
-- ---------------------------------------------------------------------------
alter table public.checklist_items enable row level security;
alter table public.visit_tasks enable row level security;
alter table public.visit_task_entries enable row level security;

revoke all on public.checklist_items from anon, authenticated;
revoke all on public.visit_tasks from anon, authenticated;
revoke all on public.visit_task_entries from anon, authenticated;
revoke all on public.visits from anon, authenticated;

grant select on public.checklist_items, public.visits, public.visit_tasks, public.visit_task_entries to authenticated;

create policy "checklist_items: caregivers and admins read" on public.checklist_items
  for select to authenticated
  using (public.current_user_role() in ('caregiver', 'admin'));
create policy "visits: admin read" on public.visits
  for select to authenticated using (public.current_user_role() = 'admin');
create policy "visit_tasks: admin read" on public.visit_tasks
  for select to authenticated using (public.current_user_role() = 'admin');
create policy "visit_task_entries: admin read" on public.visit_task_entries
  for select to authenticated using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- The entry that counts (FD-VISIT 7.2, FD-FAMVIS 7.2): the entry with the highest id per task
-- ---------------------------------------------------------------------------
create view private.visit_task_latest as
select distinct on (e.visit_task_id)
  e.visit_task_id,
  e.outcome,
  e.note,
  e.reason,
  e.logged_at
from public.visit_task_entries e
order by e.visit_task_id, e.id desc;

revoke all on private.visit_task_latest from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Caregiver's views (owner rights; each filters on auth.uid() itself; the Tech Lead reads them)
-- ---------------------------------------------------------------------------
create view public.caregiver_visit
with (security_barrier = true) as
select
  b.id as booking_id,
  private.visit_day_state(b.requested_datetime) as day_state,
  v.checked_in_at,
  v.checked_out_at,
  v.visit_note,
  o.booking_id as other_visit_booking_id,
  o.recipient_name as other_visit_recipient_name,
  o.bundle_code as other_visit_bundle_code
from public.bookings b
left join public.visits v on v.booking_id = b.id
left join lateral (
  select ov.booking_id, r.name as recipient_name, ob.bundle_code
    from public.visits ov
    join public.bookings ob on ob.id = ov.booking_id
    join public.care_recipients r on r.id = ob.care_recipient_id
   where ov.caregiver_id = auth.uid()
     and ov.checked_out_at is null
     and ov.booking_id <> b.id
   limit 1
) o on true
where b.assigned_caregiver_id = auth.uid()
  and b.status in ('assigned', 'in_progress', 'completed')
  and private.is_verified(auth.uid());

create view public.caregiver_visit_tasks
with (security_barrier = true) as
select
  v.booking_id,
  t.task_key,
  t.name,
  t.sort_order,
  t.is_required,
  t.note_required_for_done,
  l.outcome,
  l.note,
  l.reason,
  l.logged_at
from public.visits v
join public.visit_tasks t on t.visit_id = v.id
left join private.visit_task_latest l on l.visit_task_id = t.id
where v.caregiver_id = auth.uid()
  and private.is_verified(auth.uid());

revoke all on public.caregiver_visit from public, anon, authenticated;
revoke all on public.caregiver_visit_tasks from public, anon, authenticated;
grant select on public.caregiver_visit to authenticated;
grant select on public.caregiver_visit_tasks to authenticated;

-- ---------------------------------------------------------------------------
-- The family's views (FD-FAMVIS 7.2): composed on family_bookings for ownership
-- ---------------------------------------------------------------------------
create view public.family_visit
with (security_barrier = true) as
select
  fb.id as booking_id,
  v.checked_in_at,
  case when fb.status = 'completed' and v.checked_out_at is not null then v.checked_out_at end as checked_out_at,
  case when fb.status = 'completed' and v.checked_out_at is not null then v.visit_note end as visit_note
from public.family_bookings fb
join public.visits v on v.booking_id = fb.id
where fb.status in ('in_progress', 'completed');

create view public.family_visit_tasks
with (security_barrier = true) as
select
  fb.id as booking_id,
  t.sort_order,
  t.name,
  coalesce(l.outcome::text, 'not_recorded') as outcome,
  l.logged_at,
  case when l.outcome = 'not_done' then l.reason end as reason,
  l.note
from public.family_bookings fb
join public.visits v on v.booking_id = fb.id and v.checked_out_at is not null
join public.visit_tasks t on t.visit_id = v.id
left join private.visit_task_latest l on l.visit_task_id = t.id
where fb.status = 'completed';

revoke all on public.family_visit from public, anon, authenticated;
revoke all on public.family_visit_tasks from public, anon, authenticated;
grant select on public.family_visit to authenticated;
grant select on public.family_visit_tasks to authenticated;

-- ---------------------------------------------------------------------------
-- check_in(booking id) -> {booking_id, checked_in_at}   (FD-VISIT 7.3)
-- Errors (the message is the code; 42501 for NOT_CAREGIVER, P0001 for the rest):
--   NOT_CAREGIVER, BOOKING_NOT_FOUND (also: not assigned to the caller, or the caller is not
--   currently Verified), VISIT_ALREADY_CHECKED_OUT, BOOKING_NOT_ASSIGNED, NOT_VISIT_DAY,
--   ANOTHER_VISIT_IN_PROGRESS
-- ---------------------------------------------------------------------------
create function public.check_in(p_booking_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_status public.booking_status;
  v_bundle public.bundle_code;
  v_when timestamptz;
  v_now timestamptz;
  v_visit public.visits;
begin
  if public.current_user_role() is distinct from 'caregiver' then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_me and role = 'caregiver' for share;
  if not found then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  -- not Verified, not the assigned Caregiver and no such booking all give the same answer
  if not private.is_verified(v_me) then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select b.status, b.bundle_code, b.requested_datetime
    into v_status, v_bundle, v_when
    from public.bookings b
   where b.id = p_booking_id and b.assigned_caregiver_id = v_me
     for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select * into v_visit from public.visits where booking_id = p_booking_id for update;
  if found then
    if v_visit.checked_out_at is not null then
      raise exception 'VISIT_ALREADY_CHECKED_OUT';
    end if;
    return jsonb_build_object('booking_id', p_booking_id, 'checked_in_at', v_visit.checked_in_at);
  end if;

  if v_status <> 'assigned' then
    raise exception 'BOOKING_NOT_ASSIGNED';
  end if;

  v_now := private.visit_now();
  if (v_now at time zone 'Africa/Nairobi')::date <> (v_when at time zone 'Africa/Nairobi')::date then
    raise exception 'NOT_VISIT_DAY';
  end if;

  perform 1 from public.visits where caregiver_id = v_me and checked_out_at is null;
  if found then
    raise exception 'ANOTHER_VISIT_IN_PROGRESS';
  end if;

  begin
    insert into public.visits (booking_id, caregiver_id, checked_in_at)
    values (p_booking_id, v_me, v_now)
    returning * into v_visit;
  exception when unique_violation then
    -- two check-ins by the same Caregiver at the same moment: the other one won
    raise exception 'ANOTHER_VISIT_IN_PROGRESS';
  end;

  insert into public.visit_tasks (visit_id, task_key, name, sort_order, is_required, note_required_for_done)
  select v_visit.id, c.task_key, c.name, c.sort_order, c.is_required, c.note_required_for_done
    from public.checklist_items c
   where c.bundle_code = v_bundle
   order by c.sort_order;

  update public.bookings set status = 'in_progress' where id = p_booking_id;

  return jsonb_build_object('booking_id', p_booking_id, 'checked_in_at', v_visit.checked_in_at);
end;
$$;

revoke all on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- log_visit_task(booking id, task_key, outcome, note, reason)   (FD-VISIT 7.3)
-- Returns {entry_id, outcome, note, reason, logged_at, changed}: the entry that counts after the call.
-- Errors: NOT_CAREGIVER, VISIT_NOT_FOUND (also: not assigned to the caller, or the caller is not
-- currently Verified), VISIT_ALREADY_CHECKED_OUT, TASK_NOT_FOUND, INVALID_OUTCOME, REASON_REQUIRED,
-- NOTE_REQUIRED, TEXT_TOO_LONG
-- ---------------------------------------------------------------------------
create function public.log_visit_task(
  p_booking_id uuid,
  p_task_key text,
  p_outcome text,
  p_note text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_visit public.visits;
  v_task_id bigint;
  v_note_needed boolean;
  v_outcome public.visit_outcome;
  v_note text := nullif(btrim(coalesce(p_note, ''), E' \t\r\n'), '');
  v_reason text := nullif(btrim(coalesce(p_reason, ''), E' \t\r\n'), '');
  v_last public.visit_task_entries;
  v_entry public.visit_task_entries;
begin
  if public.current_user_role() is distinct from 'caregiver' then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_me and role = 'caregiver' for share;
  if not found then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  if not private.is_verified(v_me) then
    raise exception 'VISIT_NOT_FOUND';
  end if;

  perform 1 from public.bookings where id = p_booking_id and assigned_caregiver_id = v_me for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND';
  end if;

  select * into v_visit from public.visits where booking_id = p_booking_id for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND';
  end if;
  if v_visit.checked_out_at is not null then
    raise exception 'VISIT_ALREADY_CHECKED_OUT';
  end if;

  select t.id, t.note_required_for_done
    into v_task_id, v_note_needed
    from public.visit_tasks t
   where t.visit_id = v_visit.id and t.task_key = p_task_key;
  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if p_outcome is null or p_outcome not in ('done', 'not_done') then
    raise exception 'INVALID_OUTCOME';
  end if;
  v_outcome := p_outcome::public.visit_outcome;

  if v_outcome = 'done' then
    v_reason := null;
    if v_note_needed and v_note is null then
      raise exception 'NOTE_REQUIRED';
    end if;
  else
    v_note := null;
    if v_reason is null then
      raise exception 'REASON_REQUIRED';
    end if;
  end if;

  if char_length(v_note) > 2000 or char_length(v_reason) > 500 then
    raise exception 'TEXT_TOO_LONG';
  end if;

  select * into v_last
    from public.visit_task_entries
   where visit_task_id = v_task_id
   order by id desc
   limit 1;
  if found
     and v_last.outcome = v_outcome
     and v_last.note is not distinct from v_note
     and v_last.reason is not distinct from v_reason then
    return jsonb_build_object('entry_id', v_last.id, 'outcome', v_last.outcome, 'note', v_last.note,
                              'reason', v_last.reason, 'logged_at', v_last.logged_at, 'changed', false);
  end if;

  insert into public.visit_task_entries (visit_task_id, outcome, note, reason, logged_by, logged_at)
  values (v_task_id, v_outcome, v_note, v_reason, v_me, private.visit_now())
  returning * into v_entry;

  return jsonb_build_object('entry_id', v_entry.id, 'outcome', v_entry.outcome, 'note', v_entry.note,
                            'reason', v_entry.reason, 'logged_at', v_entry.logged_at, 'changed', true);
end;
$$;

revoke all on function public.log_visit_task(uuid, text, text, text, text) from public, anon;
grant execute on function public.log_visit_task(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- check_out(booking id, visit note) -> {booking_id, checked_out_at}   (FD-VISIT 7.3)
-- Errors: NOT_CAREGIVER, VISIT_NOT_FOUND (also: not assigned to the caller, or the caller is not
-- currently Verified), REQUIRED_TASKS_MISSING, TEXT_TOO_LONG
-- ---------------------------------------------------------------------------
create function public.check_out(p_booking_id uuid, p_visit_note text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_visit_note, ''), E' \t\r\n'), '');
  v_visit public.visits;
  v_now timestamptz;
begin
  if public.current_user_role() is distinct from 'caregiver' then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_me and role = 'caregiver' for share;
  if not found then
    raise exception 'NOT_CAREGIVER' using errcode = '42501';
  end if;

  if not private.is_verified(v_me) then
    raise exception 'VISIT_NOT_FOUND';
  end if;

  perform 1 from public.bookings where id = p_booking_id and assigned_caregiver_id = v_me for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND';
  end if;

  select * into v_visit from public.visits where booking_id = p_booking_id for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND';
  end if;

  -- a repeat after the visit is closed is a retry: the same answer, nothing written
  if v_visit.checked_out_at is not null then
    return jsonb_build_object('booking_id', p_booking_id, 'checked_out_at', v_visit.checked_out_at);
  end if;

  perform 1
    from public.visit_tasks t
    left join private.visit_task_latest l on l.visit_task_id = t.id
   where t.visit_id = v_visit.id and t.is_required and l.outcome is null;
  if found then
    raise exception 'REQUIRED_TASKS_MISSING';
  end if;

  if char_length(v_note) > 2000 then
    raise exception 'TEXT_TOO_LONG';
  end if;

  v_now := private.visit_now();

  update public.visits set checked_out_at = v_now, visit_note = v_note where id = v_visit.id;
  update public.bookings set status = 'completed' where id = p_booking_id;

  return jsonb_build_object('booking_id', p_booking_id, 'checked_out_at', v_now);
end;
$$;

revoke all on function public.check_out(uuid, text) from public, anon;
grant execute on function public.check_out(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; only while no visit exists, because it drops the visit tables):
--   drop the objects created above (views family_visit_tasks, family_visit, caregiver_visit_tasks,
--   caregiver_visit and private.visit_task_latest; functions check_in(uuid),
--   log_visit_task(uuid, text, text, text, text), check_out(uuid, text); tables visit_task_entries,
--   visit_tasks, checklist_items), rename test_clock.now_override back to "at", add visits.created_at
--   (timestamptz not null default clock_timestamp()), then re-run the bodies of migrations 0011, 0012,
--   0013 (the view and policy), 0014, 0015, 0016, 0018 and 0019 in that order, skipping what still exists.
-- ---------------------------------------------------------------------------
