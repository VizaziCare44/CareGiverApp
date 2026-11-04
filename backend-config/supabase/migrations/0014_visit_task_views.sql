-- DEV-072 + DEV-062 (DRAFT, the part the in-progress Assignment Detail needs): the tasks of a
-- visit with the entry that counts for each (FD-VISIT §7.2, §7.8(a); FR-005, BR-002).
--
-- private.visit_task_latest: the "entry that counts" rule, defined once: for each task, the
-- entry with the highest id. Later screens (the family's report, the Admin's exceptions) read
-- this same view, so they cannot disagree about which entry counts. It lives in the private
-- schema and is granted to no API role.
--
-- caregiver_visit_tasks: the tasks of the signed-in Caregiver's own visits, with the outcome,
-- note and reason of the entry that counts (null while the task has no entry), only while that
-- Caregiver is currently Verified. Like caregiver_visit it runs with its OWNER's rights and
-- the only barrier is the filter on auth.uid() (security_barrier keeps a caller's own filters
-- behind it): the Tech Lead should read it. Rows exist only once the Caregiver has checked in.

create view private.visit_task_latest as
select distinct on (e.visit_task_id)
  e.visit_task_id,
  e.id as entry_id,
  e.outcome,
  e.note,
  e.reason,
  e.logged_at
from public.visit_task_entries e
order by e.visit_task_id, e.id desc;

revoke all on private.visit_task_latest from public, anon, authenticated;

create view public.caregiver_visit_tasks
with (security_barrier = true) as
select
  v.booking_id,
  v.id as visit_id,
  t.id as task_id,
  t.sort_order,
  t.name,
  t.required,
  t.note_required,
  l.outcome,
  l.note,
  l.reason,
  l.logged_at
from public.visits v
join public.visit_tasks t on t.visit_id = v.id
left join private.visit_task_latest l on l.visit_task_id = t.id
where v.caregiver_id = auth.uid()
  and private.is_verified(auth.uid());

revoke all on public.caregiver_visit_tasks from public, anon, authenticated;
grant select on public.caregiver_visit_tasks to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand):
--   drop view public.caregiver_visit_tasks;
--   drop view private.visit_task_latest;
-- ---------------------------------------------------------------------------
