-- Interactive Key Map — persisted layout
--
-- The map's building position overrides and lock state are a single shared
-- document, so this is a one-row table keyed to id = 1 holding a JSONB blob:
--   { "overrides": { "<buildingId>": { "x": …, "y": …, "width": …, "height": … } },
--     "locked": false }
--
-- Matches DataStore.loadMapLayout / saveMapLayout (see src/lib/stores/supabase.ts).

create table if not exists map_layout (
  id         smallint primary key default 1,
  data       jsonb    not null default '{"overrides":{},"locked":false}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint map_layout_singleton check (id = 1)
);

-- keep updated_at fresh (reuses set_updated_at() from 0001_init.sql)
drop trigger if exists map_layout_set_updated_at on map_layout;
create trigger map_layout_set_updated_at
  before update on map_layout
  for each row execute function set_updated_at();

-- seed the singleton row so upsert/select always has something to hit
insert into map_layout (id) values (1) on conflict (id) do nothing;

-- Row Level Security — same posture as the rest of the schema: any signed-in
-- user may read and write.
alter table map_layout enable row level security;

drop policy if exists map_layout_authenticated on map_layout;
create policy map_layout_authenticated on map_layout
  for all to authenticated using (true) with check (true);
