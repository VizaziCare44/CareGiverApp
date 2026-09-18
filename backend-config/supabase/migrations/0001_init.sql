-- Vizazi Care — FD-ACC schema (§7.2).
-- Defines the bookings table's full shape now, including fields FD-ACC
-- doesn't populate, so FD-VERIFY/FD-VISIT don't force a schema rework later.

create type public.user_role as enum ('family_member', 'admin', 'caregiver');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'family_member',
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- FR-001: auto-create a profiles row from the metadata passed to
-- supabase.auth.signUp(), so account creation and profile creation happen
-- atomically from the client's point of view.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'family_member'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- care_recipients — BR-004: name required, care_notes optional.
create table public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  care_notes text,
  created_at timestamptz not null default now()
);

create index care_recipients_account_id_idx on public.care_recipients (account_id);

-- bookings — BR-001 (bundle_code enum), BR-002 (care_recipient_id NOT NULL).
create type public.bundle_code as enum ('medicheck', 'doctors_day_out');
create type public.booking_status as enum ('requested', 'assigned', 'in_progress', 'completed', 'cancelled');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  bundle_code public.bundle_code not null,
  requested_datetime timestamptz not null,
  status public.booking_status not null default 'requested',
  assigned_caregiver_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index bookings_account_id_idx on public.bookings (account_id);
create index bookings_status_idx on public.bookings (status);
