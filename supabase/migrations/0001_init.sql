-- DSU Key Management Tool — initial schema
--
-- Model notes:
--   * A "key" row is a key TYPE, identified by its stamp. Many physical copies
--     of one stamp exist, so several people can hold the same stamp at once.
--     Uniqueness is therefore on (stamp, room, building) — never on stamp alone.
--   * An "assignment" is one issuance of one key to one person. An open
--     assignment (date_returned IS NULL) means that person currently holds it.

create extension if not exists "pgcrypto";

-- ── updated_at housekeeping ───────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── people ────────────────────────────────────────────────────────────────────

create table if not exists people (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  employee_id text,
  department  text,
  building    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Names are the only identifier in the source spreadsheet today. This keeps
-- imports from silently creating "Jane Smith" twice; if DSU employee IDs get
-- added later, switch the identity index over to employee_id.
create unique index if not exists people_name_key
  on people (lower(full_name));

create index if not exists people_department_idx on people (department);
create index if not exists people_building_idx   on people (building);

drop trigger if exists people_set_updated_at on people;
create trigger people_set_updated_at
  before update on people
  for each row execute function set_updated_at();

-- ── keys ──────────────────────────────────────────────────────────────────────

create table if not exists keys (
  id               uuid primary key default gen_random_uuid(),
  key_stamp        text not null,
  room_number      text,
  room_description text,
  building         text,
  department       text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The same stamp may legitimately appear for different rooms/buildings, so the
-- identity is the whole triple. coalesce() keeps NULLs from defeating the index
-- (in Postgres, NULL <> NULL, so nulls would otherwise allow duplicates).
create unique index if not exists keys_identity_key
  on keys (lower(key_stamp), coalesce(lower(room_number), ''), coalesce(lower(building), ''));

create index if not exists keys_stamp_idx      on keys (lower(key_stamp));
create index if not exists keys_building_idx   on keys (building);
create index if not exists keys_department_idx on keys (department);

drop trigger if exists keys_set_updated_at on keys;
create trigger keys_set_updated_at
  before update on keys
  for each row execute function set_updated_at();

-- ── assignments ───────────────────────────────────────────────────────────────

create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references people (id) on delete cascade,
  key_id        uuid not null references keys (id)   on delete cascade,
  date_issued   date not null default current_date,
  date_returned date,
  num_keys      integer not null default 1 check (num_keys > 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint assignments_returned_after_issued
    check (date_returned is null or date_returned >= date_issued)
);

create index if not exists assignments_person_idx on assignments (person_id);
create index if not exists assignments_key_idx    on assignments (key_id);
create index if not exists assignments_open_idx   on assignments (date_returned)
  where date_returned is null;

-- One person can hold many different keys, and many people can hold the same
-- stamp — but the same person holding the same key twice concurrently is a
-- double-entry, not a real state. Closed (returned) rows are exempt so history
-- of repeated issue/return cycles is preserved.
create unique index if not exists assignments_one_open_per_person_key
  on assignments (person_id, key_id)
  where date_returned is null;

drop trigger if exists assignments_set_updated_at on assignments;
create trigger assignments_set_updated_at
  before update on assignments
  for each row execute function set_updated_at();

-- ── flattened read view (mirrors the spreadsheet layout) ──────────────────────

create or replace view key_records as
select
  a.id            as assignment_id,
  p.id            as person_id,
  p.full_name     as person_name,
  p.email         as person_email,
  k.id            as key_id,
  k.key_stamp,
  k.room_number,
  k.room_description,
  coalesce(k.building,   p.building)   as building,
  coalesce(k.department, p.department) as department,
  a.date_issued,
  a.date_returned,
  a.num_keys,
  a.notes,
  (a.date_returned is null) as is_active
from assignments a
join people p on p.id = a.person_id
join keys   k on k.id = a.key_id;

-- ── Row Level Security ────────────────────────────────────────────────────────
--
-- This table says which named humans can unlock which rooms. Treat it as
-- physical-security data: default deny, and never expose it to anon.
-- The anon key shipped in the frontend is public by design — RLS is the only
-- thing standing between that key and this data.

alter table people      enable row level security;
alter table keys        enable row level security;
alter table assignments enable row level security;

-- Signed-in staff get full access. To split read-only vs admin later, replace
-- the `using (true)` below with a role check against a `profiles` table.
drop policy if exists people_authenticated on people;
create policy people_authenticated on people
  for all to authenticated using (true) with check (true);

drop policy if exists keys_authenticated on keys;
create policy keys_authenticated on keys
  for all to authenticated using (true) with check (true);

drop policy if exists assignments_authenticated on assignments;
create policy assignments_authenticated on assignments
  for all to authenticated using (true) with check (true);

-- Views run with the privileges of the querying user in PG15+; make sure the
-- view cannot be used to sidestep the policies above.
alter view key_records set (security_invoker = on);

revoke all on people, keys, assignments from anon;
revoke all on key_records from anon;
