-- Vizazi Care — RLS policies (FD-ACC §7.4). This is the real access-control
-- boundary — TC-ACC-005 confirms BR-001 holds even if a client bypasses the
-- UI entirely, because these constraints/policies live at the DB level.

-- security-definer helper avoids infinite recursion when a policy on
-- `profiles` needs to check the caller's own role.
create function public.current_user_role()
returns public.user_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.care_recipients enable row level security;
alter table public.bookings enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles: self read" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: admin read all" on public.profiles
  for select using (public.current_user_role() = 'admin');

create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid());

-- care_recipients ----------------------------------------------------------
create policy "care_recipients: family CRUD own" on public.care_recipients
  for all
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "care_recipients: admin read all" on public.care_recipients
  for select using (public.current_user_role() = 'admin');

-- Caregiver placeholder — FD-VERIFY adds "read own assigned recipient" once
-- assignment exists. No caregiver access under FD-ACC (§7.4).

-- bookings -----------------------------------------------------------------
create policy "bookings: family CRUD own" on public.bookings
  for all
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "bookings: admin read all" on public.bookings
  for select using (public.current_user_role() = 'admin');

-- Caregiver placeholder — FD-VERIFY adds "read own assigned bookings" once
-- assigned_caregiver_id is populated. No caregiver access under FD-ACC (§7.4).
