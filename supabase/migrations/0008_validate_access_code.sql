-- Pre-signup access-code validation, callable by signed-out visitors.
--
-- GoTrue returns an opaque HTTP 500 for *any* exception raised inside the
-- trigger on auth.users (handle_new_user) — whether it's our intentional
-- "bad access code" check or a genuine bug — and supabase-js's client-side
-- handling for 500s (AuthRetryableFetchError) does not surface the response
-- body the way it does for a normal 4xx AuthApiError. So the friendly
-- message raised inside handle_new_user() never actually reaches the
-- browser; every failure looks like an identical blank error.
--
-- The fix: validate the code *before* ever calling auth.signUp(), through a
-- plain RPC the registration form can call while still signed out. This
-- reveals nothing about which organization a code belongs to — just whether
-- it's valid — so it can't be used to enumerate organizations. The trigger
-- keeps its own check too (defense in depth against a client that skips
-- this call and hits signUp directly).

create or replace function validate_access_code(v_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organizations
    where access_code_hash = crypt(upper(btrim(v_code)), access_code_hash)
  )
$$;

revoke execute on function validate_access_code(text) from public;
grant execute on function validate_access_code(text) to anon, authenticated;
