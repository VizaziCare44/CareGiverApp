-- DEV-031: verify_caregiver and remove_caregiver_verification (FR-002, FR-003,
-- FR-014, FR-016; AC-002, AC-009, AC-017, AC-018). The only way to write
-- caregiver_verifications (0005 closed the table to every client).
--
-- Each call: checks the caller is an Admin (before anything else), locks the
-- caregiver's profile row "for update" so two Admins acting at once are
-- serialized, checks the current state, writes exactly one history row, and
-- returns that row's id. A failed call writes nothing.
--
-- Errors are raised with the code as the message so the app can map them to
-- screen text without parsing prose:
--   NOT_ADMIN            the caller is not an Admin (SQLSTATE 42501)
--   CAREGIVER_NOT_FOUND  no profile with that id, or it is not a caregiver
--   ALREADY_VERIFIED     verify on a caregiver who is currently Verified
--   NOT_VERIFIED         remove on a caregiver who is not currently Verified
--   NOTE_REQUIRED        the note is empty or only spaces
--   NOTE_TOO_LONG        the note is over 1000 characters
-- The last four use SQLSTATE P0001. A repeated call after a lost connection
-- therefore fails with ALREADY_VERIFIED / NOT_VERIFIED rather than writing a
-- second history row.
--
-- The functions take no ID number, ID image or document (AC-017).

create function public.verify_caregiver(p_caregiver_id uuid, p_note text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_note text := btrim(coalesce(p_note, ''));
  v_id uuid;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if v_note = '' then
    raise exception 'NOTE_REQUIRED';
  end if;
  if char_length(v_note) > 1000 then
    raise exception 'NOTE_TOO_LONG';
  end if;

  perform 1 from public.profiles where id = p_caregiver_id and role = 'caregiver' for update;
  if not found then
    raise exception 'CAREGIVER_NOT_FOUND';
  end if;

  if private.is_verified(p_caregiver_id) then
    raise exception 'ALREADY_VERIFIED';
  end if;

  insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
  values (p_caregiver_id, 'verified', v_note, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create function public.remove_caregiver_verification(p_caregiver_id uuid, p_note text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_note text := btrim(coalesce(p_note, ''));
  v_id uuid;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if v_note = '' then
    raise exception 'NOTE_REQUIRED';
  end if;
  if char_length(v_note) > 1000 then
    raise exception 'NOTE_TOO_LONG';
  end if;

  perform 1 from public.profiles where id = p_caregiver_id and role = 'caregiver' for update;
  if not found then
    raise exception 'CAREGIVER_NOT_FOUND';
  end if;

  if not private.is_verified(p_caregiver_id) then
    raise exception 'NOT_VERIFIED';
  end if;

  insert into public.caregiver_verifications (caregiver_id, action, note, acted_by)
  values (p_caregiver_id, 'removed', v_note, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated
-- (see 0004), so take it back from everyone and give it to signed-in users only.
revoke all on function public.verify_caregiver(uuid, text) from public, anon;
revoke all on function public.remove_caregiver_verification(uuid, text) from public, anon;
grant execute on function public.verify_caregiver(uuid, text) to authenticated;
grant execute on function public.remove_caregiver_verification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reverse step (run by hand; history rows already written stay):
--   drop function public.remove_caregiver_verification(uuid, text);
--   drop function public.verify_caregiver(uuid, text);
-- ---------------------------------------------------------------------------
