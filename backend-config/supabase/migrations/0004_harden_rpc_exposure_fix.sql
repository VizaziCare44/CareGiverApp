-- 0003 revoked EXECUTE "from public" (the pseudo-role), but Supabase grants
-- EXECUTE to anon/authenticated as separate, explicit ACL entries on every
-- new function in the public schema — revoking from the PUBLIC pseudo-role
-- doesn't touch those. Confirmed via information_schema.routine_privileges
-- that anon/authenticated still had EXECUTE after 0003; this revokes the
-- actual grants.

revoke execute on function public.handle_new_user() from anon, authenticated;

revoke execute on function public.current_user_role() from anon;
