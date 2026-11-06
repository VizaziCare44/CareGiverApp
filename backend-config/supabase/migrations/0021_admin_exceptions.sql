-- DEV-079: the Admin's read-only exceptions list (FD-ADMINEXC §3, §5, §9; AC-001 to AC-008, AC-010,
-- AC-013, AC-015, AC-017, AC-018, AC-020, AC-021). Additive: no existing object is altered, and the
-- visit tables are only read.
--
--   private.exception_settings   (key, value): the three figures the rules depend on, in ONE place:
--                                  on_time_minutes     30  the founder's on-time threshold (2026-08-28)
--                                  in_progress_hours   8   DEC-3, how long an open visit may run
--                                  window_days         7   DEC-4, how far back the list looks
--                                No API privilege. Changed by one UPDATE by the Tech Lead (runbook
--                                addendum part 5); none of the three is written as a number in the view.
--   public.admin_exceptions      one row per booking with at least one exception, derived on every read
--                                (R-01): nothing is stored. "Now" is private.visit_now(), so the test clock
--                                applies (T3); the clock row is keyed by user, so an Admin's tests set their
--                                own and move nobody else's time.
--
-- COMPOSED on public.admin_booking_overview (FD-VERIFY §7.2, DEV-034), as family_visit is composed on
-- family_bookings: "the caller is an Admin" is decided once, in the filter already reviewed there (that view
-- returns no row to anyone else), and names, status and caregiver_verified come from the same place. It
-- selects only the columns it needs: never care notes, a phone number or an id of a caregiver. Like
-- family_bookings it runs with its OWNER's rights (so it can read the visit tables), with
-- security_barrier = true, and the Tech Lead reads the composition first (§9). Select to authenticated; a
-- family, a caregiver or any non-Admin session gets an empty list (the role is shared), anon is refused.
--
-- The exceptions (§3.1; compared in the database, exact timestamps):
--   E1 no check-in            assigned, no visit row, now later than requested + on_time_minutes
--   E2 late check-in          a visit row, checked_in_at later than requested + on_time_minutes
--                             (E1 and E2 cannot both be true; exactly on the threshold is not shown)
--   E3 check-out outstanding  in progress, the visit open, checked_in_at earlier than now - in_progress_hours
--   E4 required task not done the visit closed and a Required task's latest entry (the entry that counts,
--                             private.visit_task_latest) is Not done
--   E5 caregiver not Verified in progress and the assigned caregiver is not currently Verified
--   E6 visit record missing   completed or in progress with no visit row (the probe of FD-VISIT 7.3 item 13)
-- The window (R-02, R-05, decisions 11 and 14): assigned, in progress or completed; the requested day (Nairobi)
-- not before today - window_days; and either a visit row exists (judged by the lower bound only, so a visit
-- shows from its check-in even before the requested time) or the requested time is not after now.
--
-- The three minutes columns are whole minutes rounded DOWN (R-14), built floor(extract(epoch ...) / 60)::int and
-- null unless their own flag is true; the row decision uses the exact timestamps, so 30:01 shows a row that reads 30.
-- Columns (X2, AC-015), sixteen, tested by name: booking_id, requested_datetime, bundle_code, recipient_name,
-- caregiver_name, status; the six flags; the three minutes; not_done_tasks (a JSON list of {name, reason} in
-- checklist order). Never returned: any note, the visit note, care notes, a phone number, any id of a visit,
-- task, entry or caregiver. Rows are ordered by requested time, then booking id (R-04).

create table private.exception_settings (
  key text primary key check (key in ('on_time_minutes', 'in_progress_hours', 'window_days')),
  value integer not null check (value > 0)
);

insert into private.exception_settings (key, value) values
  ('on_time_minutes', 30),
  ('in_progress_hours', 8),
  ('window_days', 7);

revoke all on private.exception_settings from public, anon, authenticated;

create view public.admin_exceptions
with (security_barrier = true) as
with settings as (
  select
    (select s.value from private.exception_settings s where s.key = 'on_time_minutes') as on_time_minutes,
    (select s.value from private.exception_settings s where s.key = 'in_progress_hours') as in_progress_hours,
    (select s.value from private.exception_settings s where s.key = 'window_days') as window_days,
    private.visit_now() as now_at
),
base as (
  select
    o.id as booking_id,
    o.requested_datetime,
    o.bundle_code,
    o.care_recipient_name as recipient_name,
    o.caregiver_name,
    o.status,
    o.caregiver_verified,
    v.id as visit_id,
    v.checked_in_at,
    v.checked_out_at,
    s.on_time_minutes,
    s.in_progress_hours,
    s.now_at
  from public.admin_booking_overview o
  cross join settings s
  left join public.visits v on v.booking_id = o.id
  where o.status in ('assigned', 'in_progress', 'completed')
    and (o.requested_datetime at time zone 'Africa/Nairobi')::date >= (s.now_at at time zone 'Africa/Nairobi')::date - s.window_days
    and (v.id is not null or o.requested_datetime <= s.now_at)
),
flagged as (
  select
    b.*,
    (b.status = 'assigned' and b.visit_id is null
       and b.now_at > b.requested_datetime + make_interval(mins => b.on_time_minutes)) as e1,
    (b.visit_id is not null
       and b.checked_in_at > b.requested_datetime + make_interval(mins => b.on_time_minutes)) as e2,
    (b.status = 'in_progress' and b.visit_id is not null and b.checked_out_at is null
       and b.checked_in_at < b.now_at - make_interval(hours => b.in_progress_hours)) as e3,
    (b.checked_out_at is not null and exists (
       select 1
         from public.visit_tasks t
         join private.visit_task_latest l on l.visit_task_id = t.id
        where t.visit_id = b.visit_id and t.is_required and l.outcome = 'not_done')) as e4,
    (b.status = 'in_progress' and b.caregiver_verified is false) as e5,
    (b.status in ('completed', 'in_progress') and b.visit_id is null) as e6
  from base b
)
select
  f.booking_id,
  f.requested_datetime,
  f.bundle_code,
  f.recipient_name,
  f.caregiver_name,
  f.status,
  f.e1 as e1_no_check_in,
  f.e2 as e2_late_check_in,
  f.e3 as e3_check_out_outstanding,
  f.e4 as e4_required_task_not_done,
  f.e5 as e5_caregiver_not_verified,
  f.e6 as e6_visit_record_missing,
  case when f.e1 then floor(extract(epoch from f.now_at - f.requested_datetime) / 60)::int end as minutes_since_requested,
  case when f.e2 then floor(extract(epoch from f.checked_in_at - f.requested_datetime) / 60)::int end as minutes_late,
  case when f.e3 then floor(extract(epoch from f.now_at - f.checked_in_at) / 60)::int end as minutes_since_check_in,
  case when f.e4 then (
    select jsonb_agg(jsonb_build_object('name', t.name, 'reason', l.reason) order by t.sort_order)
      from public.visit_tasks t
      join private.visit_task_latest l on l.visit_task_id = t.id
     where t.visit_id = f.visit_id and t.is_required and l.outcome = 'not_done'
  ) end as not_done_tasks
from flagged f
where f.e1 or f.e2 or f.e3 or f.e4 or f.e5 or f.e6
order by f.requested_datetime, f.booking_id;

revoke all on public.admin_exceptions from public, anon, authenticated;
grant select on public.admin_exceptions to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; nothing is stored, so nothing is lost but the three settings):
--   drop view public.admin_exceptions;
--   drop table private.exception_settings;
-- ---------------------------------------------------------------------------
