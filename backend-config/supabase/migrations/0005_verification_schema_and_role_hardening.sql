-- DEV-029 (FD-VERIFY §7.2 schema additions) folded together with the role
-- hardening found by the DEV-028 audit. Additive: DEV-006's bookings table and
-- every existing row stay valid. Apply by hand with `supabase db push` after
-- the DEV-028 check query on the target database returns no rows (see the
-- note above the bookings CHECK below).

-- ---------------------------------------------------------------------------
-- 1. Role hardening (DEV-028 findings, paths A and B)
-- ---------------------------------------------------------------------------

-- Path A: the browser controls raw_user_meta_data at signUp(), so it must never
-- decide the role. raw_app_meta_data can only be written with the service-role
-- key (e.g. auth.admin.createUser({ app_metadata: { role } })), so that is the
-- one place the role may come from. Everyone else gets family_member.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, phone, email)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'family_member'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.email
  );
  return new;
end;
$$;

-- The admin API (auth.admin.createUser / updateUserById) inserts the user first
-- and writes app_metadata in a second step, so the insert trigger above never
-- sees a role passed that way. This second trigger applies a role from
-- app_metadata whenever it changes. Removing the key leaves the role as is.
create function public.sync_role_from_app_metadata()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (new.raw_app_meta_data ->> 'role') is not null
     and (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role') then
    update public.profiles
       set role = (new.raw_app_meta_data ->> 'role')::public.user_role
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_role_from_app_metadata() from public, anon, authenticated;

create trigger on_auth_user_app_metadata_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_role_from_app_metadata();

-- Path B: "self update" had no column limit, so a signed-in user could rewrite
-- their own role. Signed-in users may now change only full_name and phone, and
-- only on their own row. (email mirrors auth.users and is not editable here.)
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

drop policy "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. bookings: assignment fields and the status/caregiver rule
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column assigned_by uuid references public.profiles (id),
  add column assigned_at timestamptz;

create index bookings_assigned_caregiver_id_idx on public.bookings (assigned_caregiver_id);

-- requested: nobody assigned. assigned/in_progress/completed: caregiver, who
-- assigned and when are all set. cancelled: any (an assigned booking can be
-- cancelled and keeps its history). Fails to apply if the database already
-- holds a row that breaks it; that is intended, fix the data first.
alter table public.bookings
  add constraint bookings_status_caregiver_check check (
    (status = 'requested'
      and assigned_caregiver_id is null and assigned_by is null and assigned_at is null)
    or (status in ('assigned', 'in_progress', 'completed')
      and assigned_caregiver_id is not null and assigned_by is not null and assigned_at is not null)
    or status = 'cancelled'
  );

-- ---------------------------------------------------------------------------
-- 3. private schema (not exposed through the API) and append-only helpers
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.reject_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op;
end;
$$;

revoke all on function private.reject_modification() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. caregiver_verifications: one row per Verified / Removed decision
-- ---------------------------------------------------------------------------

create type public.verification_action as enum ('verified', 'removed');

-- No column for an ID number, ID image or background-check document (AC-017).
-- created_at uses clock_timestamp() so two rows written in one transaction
-- still order correctly for private.is_verified().
create table public.caregiver_verifications (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.profiles (id),
  action public.verification_action not null,
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  acted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp()
);

create index caregiver_verifications_caregiver_idx
  on public.caregiver_verifications (caregiver_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. booking_assignments: one row per assign / change call
-- ---------------------------------------------------------------------------

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  caregiver_id uuid not null references public.profiles (id),
  previous_caregiver_id uuid references public.profiles (id),
  assigned_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp()
);

create index booking_assignments_booking_idx
  on public.booking_assignments (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. Append-only: no rights, no policies, and a trigger as the backstop (it
--    also stops the service role). Rows are written only by the SECURITY
--    DEFINER functions in DEV-031/DEV-032; read access arrives with DEV-033.
-- ---------------------------------------------------------------------------

alter table public.caregiver_verifications enable row level security;
alter table public.booking_assignments enable row level security;

revoke all on public.caregiver_verifications from anon, authenticated;
revoke all on public.booking_assignments from anon, authenticated;

create trigger caregiver_verifications_append_only
  before update or delete on public.caregiver_verifications
  for each row execute function private.reject_modification();
create trigger caregiver_verifications_no_truncate
  before truncate on public.caregiver_verifications
  for each statement execute function private.reject_modification();

create trigger booking_assignments_append_only
  before update or delete on public.booking_assignments
  for each row execute function private.reject_modification();
create trigger booking_assignments_no_truncate
  before truncate on public.booking_assignments
  for each statement execute function private.reject_modification();

-- ---------------------------------------------------------------------------
-- 7. private.is_verified(): current state is the latest history row
-- ---------------------------------------------------------------------------

create function private.is_verified(p_caregiver uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select action = 'verified'
       from public.caregiver_verifications
      where caregiver_id = p_caregiver
      order by created_at desc, id desc
      limit 1),
    false
  );
$$;

revoke all on function private.is_verified(uuid) from public, anon;
grant execute on function private.is_verified(uuid) to authenticated;

-- The role helper from the ticket already exists as public.current_user_role()
-- (0002), so none is added here.

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand, in this order; loses any history rows written):
--   drop function private.is_verified(uuid);
--   drop table public.booking_assignments, public.caregiver_verifications;
--   drop type public.verification_action;
--   drop function private.reject_modification();
--   drop schema private;
--   alter table public.bookings drop constraint bookings_status_caregiver_check;
--   drop index public.bookings_assigned_caregiver_id_idx;
--   alter table public.bookings drop column assigned_by, drop column assigned_at;
--   drop trigger on_auth_user_app_metadata_changed on auth.users;
--   drop function public.sync_role_from_app_metadata();
--   -- the rest of the role hardening has intentionally no reverse: putting
--   -- back the old trigger or the open profiles update re-opens the Admin
--   -- escalation hole.
-- ---------------------------------------------------------------------------
