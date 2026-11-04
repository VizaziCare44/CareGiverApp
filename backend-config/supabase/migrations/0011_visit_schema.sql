-- DEV-059 (DRAFT): the visit schema (FD-VISIT §7.2), written while FD-VISIT was not
-- available, from the task texts alone. Every choice marked DRAFT below is to be checked
-- against §7.2 and corrected in a later migration (migrations are append-only, so a
-- correction is a new file, not an edit of this one). Additive: nothing existing is
-- altered, and `bookings` gets no column and no new privilege.
--
-- What is stored:
--   checklist_items      the tasks of each bundle, in order, with Required / Optional and
--                        whether a note is needed (the 7 rows seeded below)
--   visits               one row per booking that was checked in to (booking_id is unique:
--                        "each booking is one visit"); open while checked_out_at is null
--   visit_tasks          the checklist as it was at check-in (a snapshot, so a later change
--                        to checklist_items never changes a visit already started)
--   visit_task_entries   what the Caregiver logged against a task; only ever added to, the
--                        entry with the highest id is the one that counts
--   private.test_clock   zero rows in production; a row makes private.visit_now() return
--                        that moment (used by tests only)
-- No column for location, device or IP address (BR-010, AC-017).
--
-- Nobody but the SECURITY DEFINER functions (migration 0012 and later) writes these tables:
-- row-level security is on, there are no policies, and every privilege is taken back from
-- anon and authenticated.

create type public.visit_outcome as enum ('done', 'not_done');

-- ---------------------------------------------------------------------------
-- checklist_items. DRAFT: the seven rows are the seven things each bundle includes
-- (three for MediCheck, four for Doctor's Day Out); which are Required and which need a
-- note are guesses from the task texts (three tasks need a note; Vitals check takes
-- "Readings"). Readable by Caregivers and Admins through migration 0013.
-- ---------------------------------------------------------------------------

create table public.checklist_items (
  id smallint generated always as identity primary key,
  bundle_code public.bundle_code not null,
  sort_order smallint not null check (sort_order > 0),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  required boolean not null,
  note_required boolean not null default false,
  unique (bundle_code, sort_order),
  unique (bundle_code, name)
);

insert into public.checklist_items (bundle_code, sort_order, name, required, note_required) values
  ('medicheck', 1, 'Medication assistance', true, false),
  ('medicheck', 2, 'Vitals check', true, true),
  ('medicheck', 3, 'Companionship', false, false),
  ('doctors_day_out', 1, 'Pre-visit preparation', true, false),
  ('doctors_day_out', 2, 'Transport & escort', true, false),
  ('doctors_day_out', 3, 'Advocacy and note-taking', true, true),
  ('doctors_day_out', 4, 'Post-visit report', true, true);

-- ---------------------------------------------------------------------------
-- visits, visit_tasks, visit_task_entries
-- ---------------------------------------------------------------------------

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id),
  caregiver_id uuid not null references public.profiles (id),
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  visit_note text check (visit_note is null or char_length(btrim(visit_note)) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp(),
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);

-- A Caregiver has at most one visit open at a time.
create unique index visits_one_open_per_caregiver
  on public.visits (caregiver_id) where checked_out_at is null;

create table public.visit_tasks (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id),
  checklist_item_id smallint not null references public.checklist_items (id),
  sort_order smallint not null,
  name text not null,
  required boolean not null,
  note_required boolean not null,
  unique (visit_id, checklist_item_id)
);

create index visit_tasks_visit_idx on public.visit_tasks (visit_id, sort_order);

create table public.visit_task_entries (
  id bigint generated always as identity primary key,
  visit_task_id uuid not null references public.visit_tasks (id),
  outcome public.visit_outcome not null,
  note text check (note is null or char_length(btrim(note)) between 1 and 1000),
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 1000),
  logged_at timestamptz not null,
  -- a task marked Not done must say why
  check (outcome <> 'not_done' or reason is not null)
);

create index visit_task_entries_task_idx on public.visit_task_entries (visit_task_id, id desc);

-- ---------------------------------------------------------------------------
-- Rules the tables keep for themselves (they also stop the service role)
--   visits: never deleted; a closed visit never changes; booking, Caregiver and
--           check-in time never change
--   visit_tasks, visit_task_entries: never updated or deleted
--   visit_task_entries: nothing added once the visit is closed
-- ---------------------------------------------------------------------------

create function private.guard_visit_update()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'visits is append-only: DELETE is not allowed';
  end if;
  if old.checked_out_at is not null then
    raise exception 'VISIT_CLOSED';
  end if;
  if new.booking_id <> old.booking_id
     or new.caregiver_id <> old.caregiver_id
     or new.checked_in_at <> old.checked_in_at then
    raise exception 'visits: booking, caregiver and check-in time cannot change';
  end if;
  return new;
end;
$$;

create function private.guard_entry_insert()
returns trigger
language plpgsql
as $$
begin
  perform 1
    from public.visit_tasks t
    join public.visits v on v.id = t.visit_id
   where t.id = new.visit_task_id and v.checked_out_at is null;
  if not found then
    raise exception 'VISIT_CLOSED';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_visit_update() from public, anon, authenticated;
revoke all on function private.guard_entry_insert() from public, anon, authenticated;

create trigger visits_guard
  before update or delete on public.visits
  for each row execute function private.guard_visit_update();
create trigger visits_no_truncate
  before truncate on public.visits
  for each statement execute function private.reject_modification();

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
-- Access: none for the API roles
-- ---------------------------------------------------------------------------

alter table public.checklist_items enable row level security;
alter table public.visits enable row level security;
alter table public.visit_tasks enable row level security;
alter table public.visit_task_entries enable row level security;

revoke all on public.checklist_items from anon, authenticated;
revoke all on public.visits from anon, authenticated;
revoke all on public.visit_tasks from anon, authenticated;
revoke all on public.visit_task_entries from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The test clock. Zero rows in production (checked at release). With a row, every time the
-- visit functions take comes from here, so a test can say what "now" is without waiting.
-- ---------------------------------------------------------------------------

create table private.test_clock (
  only_row boolean primary key default true check (only_row),
  at timestamptz not null
);

revoke all on private.test_clock from public, anon, authenticated;

create function private.visit_now()
returns timestamptz
language sql
stable
security definer set search_path = ''
as $$
  select coalesce((select at from private.test_clock), clock_timestamp());
$$;

revoke all on function private.visit_now() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand, in this order; loses every visit written):
--   drop function private.visit_now();
--   drop table private.test_clock;
--   drop table public.visit_task_entries, public.visit_tasks, public.visits, public.checklist_items;
--   drop function private.guard_entry_insert();
--   drop function private.guard_visit_update();
--   drop type public.visit_outcome;
-- ---------------------------------------------------------------------------
