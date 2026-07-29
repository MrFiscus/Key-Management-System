-- Fix "function crypt(text, text) does not exist".
--
-- Every SECURITY DEFINER function that calls crypt()/gen_salt()/
-- gen_random_bytes() was pinned to `search_path = public`. On Supabase,
-- `create extension pgcrypto` (0001_init.sql) installs its functions into
-- the `extensions` schema, not `public` — so none of those calls could ever
-- resolve, and every one of these functions has been failing. For
-- handle_new_user specifically, that failure is a trigger on auth.users, so
-- GoTrue turned it into an opaque HTTP 500 with no visible message, which is
-- exactly what surfaced as a blank "{}" error while registering.
--
-- Fix: include `extensions` in the search_path (harmless to list even if a
-- given project keeps pgcrypto somewhere else, or in public — Postgres just
-- skips a schema in the path that doesn't contain the function it's
-- looking for).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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

create or replace function validate_access_code(v_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from organizations
    where access_code_hash = crypt(upper(btrim(v_code)), access_code_hash)
  )
$$;

create or replace function admin_create_organization(v_name text)
returns table (id uuid, name text, access_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id   uuid;
  v_code text;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'Organization name is required.';
  end if;

  v_code := upper(
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4)
  );

  insert into organizations (name, access_code_hash)
  values (btrim(v_name), crypt(v_code, gen_salt('bf')))
  returning organizations.id into v_id;

  perform log_admin_action('org_created', v_id::text, btrim(v_name));

  return query select v_id, btrim(v_name), v_code;
end;
$$;

create or replace function admin_rotate_access_code(v_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_name text;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;

  select name into v_name from organizations where id = v_org_id;
  if v_name is null then
    raise exception 'Organization not found.';
  end if;

  v_code := upper(
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(8), 'hex'), 1, 4)
  );

  update organizations set access_code_hash = crypt(v_code, gen_salt('bf')) where id = v_org_id;

  perform log_admin_action('access_code_rotated', v_org_id::text, v_name);

  return v_code;
end;
$$;
