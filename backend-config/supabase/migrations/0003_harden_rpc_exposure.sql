-- Supabase security advisor flagged both SECURITY DEFINER functions as
-- publicly callable via PostgREST RPC (/rest/v1/rpc/<fn>). Neither is meant
-- to be called that way:
--   - handle_new_user() only ever runs via the on_auth_user_created trigger;
--     trigger firing doesn't require the DML role to hold EXECUTE, so it's
--     safe to strip entirely.
--   - current_user_role() is called from inside the RLS policies on
--     profiles/care_recipients/bookings (§7.4), so `authenticated` must
--     keep EXECUTE or every admin-read-all policy breaks. `anon` has no
--     legitimate reason to call it directly — anon has no profiles row, so
--     revoking here changes nothing anon could actually see, it just closes
--     an unnecessary direct-RPC surface.

revoke execute on function public.handle_new_user() from public;

revoke execute on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
