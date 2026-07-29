-- Platform admin: organization & account management
--
-- This adds a strict, audit-logged admin surface for managing organizations
-- and user accounts across the whole deployment. It is deliberately built so
-- that no client-side bug or compromised session can escalate privileges or
-- read a secret it shouldn't:
--
--   * Admin status (profiles.is_platform_admin) has NO client-reachable way
--     to be set. It can only be granted by running SQL directly against the
--     database (Supabase SQL editor / dashboard). See the bottom of this
--     file for the exact statement.
--   * Every admin operation is a SECURITY DEFINER function that re-checks
--     is_platform_admin() itself — there is no RLS policy anywhere that
--     hands a broader table grant to admins. The client never gets to run
--     an arbitrary query against `organizations` or other users' `profiles`.
--   * Access codes move from plaintext to bcrypt hashes (pgcrypto, already
--     enabled in 0001_init.sql). A full database dump no longer exposes any
--     organization's code. A code is only ever shown in plaintext once, at
--     the moment it is generated or rotated, straight from the RPC response
--     — it is never stored or logged anywhere in readable form.
--   * Every sensitive action (org created, code rotated, user revoked) is
--     written to admin_audit_log, which only admins can read and which
--     nothing but these functions can write to.

alter table profiles add column if not exists is_platform_admin boolean not null default false;

create or replace function is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select p.is_platform_admin from profiles p where p.id = auth.uid()), false)
$$;

-- ── access codes: plaintext column → bcrypt hash ────────────────────────────

alter table organizations add column if not exists access_code_hash text;

-- Guarded so this migration can be re-run safely: if a previous run already
-- got as far as dropping the plaintext column, there's nothing left to
-- backfill from, and referencing it directly would fail with
-- "column access_code does not exist".
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'access_code'
  ) then
    update organizations
    set access_code_hash = crypt(access_code, gen_salt('bf'))
    where access_code_hash is null;
  end if;
end $$;

alter table organizations alter column access_code_hash set not null;
drop index if exists organizations_access_code_key;
alter table organizations drop column if exists access_code;

-- Registration now checks the hash. bcrypt compares one row at a time (no
-- index can point into a salted hash), so this scans every organization —
-- perfectly fine at the scale a table of organizations actually reaches;
-- revisit if this deployment ever manages thousands of them.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := btrim(new.raw_user_meta_data ->> 'access_code');
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

-- ── audit log ────────────────────────────────────────────────────────────────

create table if not exists admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id),
  actor_email text,
  action      text not null,
  target      text,
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);

alter table admin_audit_log enable row level security;

drop policy if exists admin_audit_log_admin_read on admin_audit_log;
create policy admin_audit_log_admin_read on admin_audit_log
  for select to authenticated using (is_platform_admin());

-- No insert/update/delete policy for authenticated at all — only the
-- SECURITY DEFINER functions below ever write here.
revoke all on admin_audit_log from anon, authenticated;
grant select on admin_audit_log to authenticated;

create or replace function log_admin_action(v_action text, v_target text, v_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into admin_audit_log (actor_id, actor_email, action, target, detail)
  values (auth.uid(), (select email from profiles where id = auth.uid()), v_action, v_target, v_detail);
end;
$$;

-- Not directly callable by anyone — only invoked internally by the
-- SECURITY DEFINER functions below, which run as this function's owner
-- regardless of the calling client's own grants.
revoke execute on function log_admin_action(text, text, text) from public, anon, authenticated;

-- ── admin RPCs ───────────────────────────────────────────────────────────────

create or replace function admin_list_organizations()
returns table (id uuid, name text, member_count bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;

  return query
    select o.id, o.name, count(p.id), o.created_at
    from organizations o
    left join profiles p on p.org_id = o.id
    group by o.id, o.name, o.created_at
    order by o.created_at desc;
end;
$$;

create or replace function admin_create_organization(v_name text)
returns table (id uuid, name text, access_code text)
language plpgsql
security definer
set search_path = public
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

  -- 4 independently-random 4-hex-char groups — 64 bits of entropy, shown
  -- exactly once in the return value of this call.
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
set search_path = public
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

create or replace function admin_list_users()
returns table (
  id uuid, email text, full_name text, org_id uuid, org_name text,
  is_platform_admin boolean, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;

  return query
    select p.id, p.email, p.full_name, p.org_id, o.name, p.is_platform_admin, p.created_at
    from profiles p
    join organizations o on o.id = p.org_id
    order by p.created_at desc;
end;
$$;

create or replace function admin_revoke_user(v_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;
  if v_user_id = auth.uid() then
    raise exception 'You cannot revoke your own account from here.';
  end if;

  select email into v_email from profiles where id = v_user_id;
  if v_email is null then
    raise exception 'User not found.';
  end if;

  delete from auth.users where id = v_user_id;

  perform log_admin_action('user_revoked', v_user_id::text, v_email);
end;
$$;

create or replace function admin_list_audit_log(v_limit int default 100)
returns table (
  id uuid, actor_email text, action text, target text, detail text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;

  return query
    select a.id, a.actor_email, a.action, a.target, a.detail, a.created_at
    from admin_audit_log a
    order by a.created_at desc
    limit least(v_limit, 500);
end;
$$;

-- Every admin_* RPC is callable by signed-in users only (the function body
-- still gates on is_platform_admin() itself — this just keeps anon from
-- reaching them at all).
revoke execute on function admin_list_organizations()      from public, anon;
revoke execute on function admin_create_organization(text) from public, anon;
revoke execute on function admin_rotate_access_code(uuid)  from public, anon;
revoke execute on function admin_list_users()               from public, anon;
revoke execute on function admin_revoke_user(uuid)          from public, anon;
revoke execute on function admin_list_audit_log(int)        from public, anon;

grant execute on function admin_list_organizations()      to authenticated;
grant execute on function admin_create_organization(text) to authenticated;
grant execute on function admin_rotate_access_code(uuid)  to authenticated;
grant execute on function admin_list_users()               to authenticated;
grant execute on function admin_revoke_user(uuid)          to authenticated;
grant execute on function admin_list_audit_log(int)        to authenticated;

-- ── bootstrap ────────────────────────────────────────────────────────────────
-- There is no UI path to grant the first admin — run this once by hand:
--   update profiles set is_platform_admin = true where email = 'you@fipherkeys.com';
