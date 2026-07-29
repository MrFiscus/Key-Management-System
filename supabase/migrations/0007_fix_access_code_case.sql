-- Restore case-insensitive access codes.
--
-- 0005 matched codes with lower(access_code) = lower(input) — case never
-- mattered. The bcrypt switch in 0006 accidentally made this case-sensitive,
-- because crypt() hashes the exact bytes it's given: a code typed in a
-- different case than it was created with no longer matches its hash.
--
-- admin_create_organization / admin_rotate_access_code already generate
-- codes via upper(...), so normalizing the incoming code to uppercase here
-- restores case-insensitive matching without needing to touch any stored
-- hash.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := upper(btrim(new.raw_user_meta_data ->> 'access_code'));
  v_org_id uuid;
begin
  if v_code is null or v_code = '' then
    raise exception 'An access code is required to register.';
  end if;

  select id into v_org_id
  from organizations
  where access_code_hash = crypt(v_code, access_code_hash)
  limit 1;

  if v_org_id is null then
    raise exception 'That access code was not recognized.';
  end if;

  insert into profiles (id, org_id, full_name, email)
  values (new.id, v_org_id, new.raw_user_meta_data ->> 'full_name', new.email);

  return new;
end;
$$;
