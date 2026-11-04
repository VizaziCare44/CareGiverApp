-- DEV-073 (DRAFT): the two views the family reads a visit through (FD-FAMVIS §7.2, §7.4; FR-009,
-- BR-001, BR-002, BR-005, BR-010; AC-007, AC-008), written while FD-FAMVIS was not available: the
-- column list and the rules are taken from the task texts (DEV-073, DEV-075, DEV-076) and are to be
-- checked against §7.2. Additive: nothing existing is altered, and family_bookings is unchanged.
--
--   public.family_visit        one row per visit of a booking the signed-in family owns whose status is
--                              in progress or completed:
--                                booking_id
--                                checked_in_at   always
--                                checked_out_at  only when the booking is completed AND the visit is closed
--                                visit_note      the same condition
--   public.family_visit_tasks  rows ONLY when the booking is completed and the visit is closed: one per task
--                              of the visit's snapshot, in sort_order:
--                                booking_id, sort_order, name
--                                outcome    done | not_done | not_recorded (an Optional task never logged)
--                                logged_at  the time of the entry that counts; null when not_recorded
--                                reason     only for not_done
--                                note       only for done
--                              No is_required, no task or visit or entry id, no earlier entry (the entry that
--                              counts is the highest id, private.visit_task_latest, DEV-072).
--
-- OWNERSHIP: both views are composed on public.family_bookings, which keeps only the signed-in family's own
-- bookings (where b.account_id = auth.uid()); they add no ownership rule of their own. Like family_bookings,
-- they run with their OWNER's rights, so they can read the visit tables the API roles cannot, and that
-- composition plus the completed-and-closed condition are the only barrier between one family's visits and
-- another's, or between an open visit's tasks and a family: the Tech Lead reviews them (§7.8(d)).
-- security_barrier = true, as family_bookings has it, so a caller's own filter (a request that adds
-- ?note=...) is applied only after the views' own conditions (§7.8(b): the Tech Lead decides).
--
-- A closed visit has an outcome for every Required task (check_out refuses otherwise). If one does not (a hand
-- edit), family_visit_tasks returns NO rows for that visit rather than a report with a Required task shown as
-- Not recorded: the screen then shows its "couldn't load" state, and the probe lists the visit. "No Required task
-- is ever Not recorded" holds by construction.
--
-- Select to authenticated; nothing for public or anon.

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
  case when l.outcome = 'done' then l.note end as note
from public.family_bookings fb
join public.visits v on v.booking_id = fb.id and v.checked_out_at is not null
join public.visit_tasks t on t.visit_id = v.id
left join private.visit_task_latest l on l.visit_task_id = t.id
where fb.status = 'completed'
  and not exists (
    select 1
      from public.visit_tasks r
      left join private.visit_task_latest rl on rl.visit_task_id = r.id
     where r.visit_id = v.id and r.required and rl.outcome is null
  );

revoke all on public.family_visit from public, anon, authenticated;
revoke all on public.family_visit_tasks from public, anon, authenticated;
grant select on public.family_visit to authenticated;
grant select on public.family_visit_tasks to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand):
--   drop view public.family_visit_tasks;
--   drop view public.family_visit;
-- ---------------------------------------------------------------------------
