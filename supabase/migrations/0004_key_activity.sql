-- Key edit history — shown on a user's profile page ("last 5 keys you've
-- updated") so changes to the catalog stay attributable, not anonymous.
--
-- One row per create/update of a key, or issue/return of an assignment
-- against that key. key_id has no FK to keys(id): if the key is later
-- deleted, its edit history should still read (the stamp is stored directly
-- on the row for that reason), so this intentionally isn't ON DELETE CASCADE.
--
-- Matches DataStore.getRecentKeyActivity (see src/lib/stores/supabase.ts).

create table if not exists key_activity (
  id         uuid primary key default gen_random_uuid(),
  key_id     uuid,
  key_stamp  text not null,
  action     text not null,
  actor_email text,
  created_at timestamptz not null default now()
);

-- Re-runnable even if this table (and its old 'created'/'updated'-only check)
-- already exists from an earlier apply of this same migration.
alter table key_activity drop constraint if exists key_activity_action_check;
alter table key_activity add constraint key_activity_action_check
  check (action in ('created', 'updated', 'issued', 'returned'));

create index if not exists key_activity_actor_idx on key_activity (actor_email, created_at desc);

-- Row Level Security — same posture as the rest of the schema: any signed-in
-- user may read and write (write happens as a side effect of createKey/
-- updateKey, never directly from the UI).
alter table key_activity enable row level security;

drop policy if exists key_activity_authenticated on key_activity;
create policy key_activity_authenticated on key_activity
  for all to authenticated using (true) with check (true);
