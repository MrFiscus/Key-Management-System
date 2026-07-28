-- Multi-organization support + self-service registration
--
-- Every table that holds an org's own data now carries an org_id, and Row
-- Level Security scopes every read/write to the signed-in user's own
-- organization. A new user joins an org by registering with that org's
-- access code (see RegisterView.tsx); a trigger on auth.users resolves the
-- code to an org_id and creates the user's profile row server-side, before
-- the client ever sees a session — an invalid code aborts the sign-up
-- entirely. The access code itself is never exposed to the client:
-- `organizations` has no SELECT policy at all.

-- ── organizations ─────────────────────────────────────────────────────────────

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  access_code text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists organizations_access_code_key
  on organizations (lower(access_code));

-- Seed the one organization this deployment has served until now, so the
-- backfill below has somewhere to point existing rows at. Rotate this code
-- after go-live: update organizations set access_code = '...' where name = 'Dakota State University';
insert into organizations (name, access_code)
values ('Dakota State University', 'DSU-FACILITIES-2026')
on conflict do nothing;

alter table organizations enable row level security;
-- Intentionally no policies — readable only by the SECURITY DEFINER trigger
-- below (which runs as the table owner and bypasses RLS), never directly by
-- anon or authenticated clients.
revoke all on organizations from anon, authenticated;

-- ── profiles ──────────────────────────────────────────────────────────────────
-- One row per auth.users row, created automatically at sign-up. This is what
-- ties a signed-in session to an organization.

create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  org_id     uuid not null references organizations (id),
  full_name  text,
  email      text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for select to authenticated using (id = auth.uid());

revoke all on profiles from anon;

-- Every other RLS policy in this migration scopes rows to the caller's own
-- organization via this helper. Runs as invoker: profiles_self above already
-- grants a signed-in user access to exactly their own row, which is all this
-- needs to read.
create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- ── registration trigger ────────────────────────────────────────────────────
-- The client passes { full_name, access_code } as auth signUp options.data
-- (see RegisterView.tsx). This fires as part of the same transaction as the
-- auth.users insert, so a bad code rolls the whole sign-up back instead of
-- leaving an orphaned, org-less account behind.

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

  select id into v_org_id from organizations where lower(access_code) = lower(v_code);
  if v_org_id is null then
    raise exception 'That access code was not recognized.';
  end if;

  insert into profiles (id, org_id, full_name, email)
  values (new.id, v_org_id, new.raw_user_meta_data ->> 'full_name', new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── scope existing data by organization ─────────────────────────────────────
-- org_id gets a DEFAULT of current_org_id(), so nothing in the app layer
-- (src/lib/stores/supabase.ts) needs to change to start populating it.

do $$
declare
  v_dsu_id uuid;
begin
  select id into v_dsu_id from organizations where name = 'Dakota State University';

  alter table people       add column if not exists org_id uuid references organizations (id);
  alter table keys         add column if not exists org_id uuid references organizations (id);
  alter table assignments  add column if not exists org_id uuid references organizations (id);
  alter table key_activity add column if not exists org_id uuid references organizations (id);

  update people       set org_id = v_dsu_id where org_id is null;
  update keys         set org_id = v_dsu_id where org_id is null;
  update assignments  set org_id = v_dsu_id where org_id is null;
  update key_activity set org_id = v_dsu_id where org_id is null;
end $$;

alter table people       alter column org_id set not null;
alter table keys         alter column org_id set not null;
alter table assignments  alter column org_id set not null;
alter table key_activity alter column org_id set not null;

alter table people       alter column org_id set default current_org_id();
alter table keys         alter column org_id set default current_org_id();
alter table assignments  alter column org_id set default current_org_id();
alter table key_activity alter column org_id set default current_org_id();

create index if not exists people_org_idx       on people (org_id);
create index if not exists keys_org_idx         on keys (org_id);
create index if not exists assignments_org_idx  on assignments (org_id);
create index if not exists key_activity_org_idx on key_activity (org_id);

-- Replace the "any signed-in user sees everything" policies with org-scoped
-- ones — same shape, now gated on org_id as well.

drop policy if exists people_authenticated on people;
create policy people_org on people
  for all to authenticated using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists keys_authenticated on keys;
create policy keys_org on keys
  for all to authenticated using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists assignments_authenticated on assignments;
create policy assignments_org on assignments
  for all to authenticated using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists key_activity_authenticated on key_activity;
create policy key_activity_org on key_activity
  for all to authenticated using (org_id = current_org_id()) with check (org_id = current_org_id());

-- ── map_layout becomes one row per organization ─────────────────────────────
-- Was a singleton (id = 1); now keyed by org_id so each organization gets its
-- own building-position overrides and lock state. See
-- DataStore.loadMapLayout / saveMapLayout in src/lib/stores/supabase.ts,
-- updated in this same change to drop the id = 1 filter.

do $$
declare
  v_dsu_id uuid;
begin
  select id into v_dsu_id from organizations where name = 'Dakota State University';

  alter table map_layout add column if not exists org_id uuid references organizations (id);
  update map_layout set org_id = v_dsu_id where org_id is null;
end $$;

alter table map_layout alter column org_id set not null;
alter table map_layout alter column org_id set default current_org_id();
alter table map_layout drop constraint if exists map_layout_singleton;
alter table map_layout drop constraint if exists map_layout_pkey;
alter table map_layout drop column if exists id;
alter table map_layout add primary key (org_id);

drop policy if exists map_layout_authenticated on map_layout;
create policy map_layout_org on map_layout
  for all to authenticated using (org_id = current_org_id()) with check (org_id = current_org_id());
