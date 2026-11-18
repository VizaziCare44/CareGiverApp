-- Care recipients can no longer be deleted or truncated through the API (found
-- while verifying the bookings write path after 0006, 2026-11-18). Review this
-- migration first.
--
-- Before: policy "care_recipients: family CRUD own" and the default rights let a
-- Family Member
--   * delete their own care recipient. bookings.care_recipient_id cascades, so a
--     booking still in `requested` was deleted with it, silently and without a
--     record (once a booking is assigned or has a visit, the foreign keys of
--     booking_assignments and visits refuse the delete);
--   * TRUNCATE the table. Row-level security does not apply to TRUNCATE, so any
--     signed-in user could empty care_recipients for every family, with the same
--     cascade onto unassigned bookings.
-- The app never deletes a recipient (recipients are only added and listed).
--
-- After: read, insert and update own, as before. Nothing else through the API
-- for any role. Deleting an account in the dashboard or with the service role
-- still removes its recipients (the cascade from profiles runs as the owner,
-- not as the caller), so provisioning and test clean-up are not affected.

revoke all on public.care_recipients from anon, authenticated;
grant select, insert, update on public.care_recipients to authenticated;
