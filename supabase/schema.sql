-- World Cup Draft Fantasy League - Supabase schema
--
-- Mirrors the shapes in src/lib/types.ts and src/lib/selectors.ts so the
-- mocked Zustand store (src/lib/store/league-store.ts) can be swapped for
-- Supabase-backed reads/writes without changing the app's data model.
--
-- The MVP runs entirely on local seed data + localStorage and does not
-- require this schema. Apply it when you're ready to move to a shared,
-- multi-device backend (see README "Next improvements").

-- ============================================================
-- managers
-- ============================================================
create table if not exists managers (
  id text primary key,
  name text not null,
  initials text not null,
  color text not null,
  tagline text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- squad_assets
-- ============================================================
create table if not exists squad_assets (
  id text primary key,
  manager_id text not null references managers(id) on delete cascade,
  slot integer not null check (slot between 1 and 8),
  name text not null,
  country text not null,
  country_code text not null,
  position text not null check (position in ('Goalkeeper', 'Defender', 'Midfielder', 'Striker', 'Team')),
  asset_type text not null check (asset_type in ('player', 'team')),
  created_at timestamptz not null default now(),
  unique (manager_id, slot)
);

create index if not exists idx_squad_assets_manager on squad_assets(manager_id);

-- ============================================================
-- matches
-- ============================================================
create table if not exists matches (
  id text primary key,
  stage text not null,
  home_team text not null,
  home_country_code text not null,
  away_team text not null,
  away_country_code text not null,
  kickoff timestamptz not null,
  status text not null check (status in ('upcoming', 'live', 'completed')),
  home_score integer,
  away_score integer,
  minute integer,
  -- Which side actually won when the score can't say so (a knockout tie
  -- decided on penalties); null for an unfinished match or a genuine draw.
  -- Mirrors Match.winner in src/lib/types.ts.
  winner text check (winner in ('home', 'away')),
  venue text not null,
  locked boolean not null default false
);

create index if not exists idx_matches_status on matches(status);

-- ============================================================
-- scoring_rules
-- Single current rule set. Keep one row (id = 1); updates are
-- versioned via audit_log rather than a history table for the MVP.
-- ============================================================
create table if not exists scoring_rules (
  id integer primary key default 1 check (id = 1),
  goal integer not null default 4,
  assist integer not null default 2,
  clean_sheet_defender_gk integer not null default 2,
  yellow_card integer not null default -1,
  red_card integer not null default -2,
  own_goal integer not null default -2,
  missed_penalty integer not null default -1,
  penalty_saved integer not null default 4,
  team_win integer not null default 1,
  team_loss integer not null default -1,
  team_scored_3plus integer not null default 1,
  team_conceded_3plus integer not null default -1,
  updated_at timestamptz not null default now()
);

insert into scoring_rules (id)
values (1)
on conflict (id) do nothing;

-- ============================================================
-- fantasy_events
-- ============================================================
create table if not exists fantasy_events (
  id text primary key,
  match_id text references matches(id) on delete set null,
  asset_id text not null references squad_assets(id) on delete cascade,
  manager_id text not null references managers(id) on delete cascade,
  type text not null check (type in (
    'goal', 'assist', 'yellow_card', 'red_card', 'own_goal',
    'penalty_saved', 'penalty_missed', 'clean_sheet',
    'team_win', 'team_loss', 'team_scored_3plus', 'team_conceded_3plus',
    'manual_adjustment'
  )),
  points integer not null,
  minute integer,
  detail text,
  created_at timestamptz not null default now(),
  source text not null check (source in ('seed', 'mock', 'api', 'manual')),
  -- Dedup hash: fixtureId:assetId:minute:type:detail. Null for
  -- manually-created events, which can never collide with API events.
  event_hash text unique
);

create index if not exists idx_fantasy_events_asset on fantasy_events(asset_id);
create index if not exists idx_fantasy_events_manager on fantasy_events(manager_id);
create index if not exists idx_fantasy_events_match on fantasy_events(match_id);

-- ============================================================
-- manual_adjustments
-- ============================================================
create table if not exists manual_adjustments (
  id text primary key,
  manager_id text not null references managers(id) on delete cascade,
  -- Null when the adjustment applies to the manager's total directly
  -- rather than a specific squad asset.
  asset_id text references squad_assets(id) on delete cascade,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists idx_manual_adjustments_manager on manual_adjustments(manager_id);

-- ============================================================
-- audit_log
-- ============================================================
create table if not exists audit_log (
  id text primary key,
  action text not null check (action in (
    'create_event', 'update_event', 'delete_event',
    'manual_adjustment', 'update_scoring_rules', 'recalculate_points',
    'lock_match', 'unlock_match'
  )),
  actor text not null,
  manager_id text references managers(id) on delete set null,
  manager_name text,
  asset_id text references squad_assets(id) on delete set null,
  asset_name text,
  old_value text,
  new_value text,
  reason text,
  timestamp timestamptz not null default now()
);

create index if not exists idx_audit_log_timestamp on audit_log(timestamp desc);

-- ============================================================
-- api_event_cache
-- Tracks dedup hashes already ingested from the live-data provider,
-- independent of whether they produced a fantasy_events row.
-- ============================================================
create table if not exists api_event_cache (
  hash text primary key,
  fixture_id text not null,
  processed_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
--
-- Everything is publicly readable (the league is a shareable
-- public link). Writes are expected to go through a server-side
-- role using the service key, gated by the app's admin-password
-- check (src/lib/auth.ts). When migrating to Supabase Auth, replace
-- the "service role only" write policies below with role-based
-- checks (e.g. auth.jwt() ->> 'role' = 'admin').
-- ============================================================
alter table managers enable row level security;
alter table squad_assets enable row level security;
alter table matches enable row level security;
alter table fantasy_events enable row level security;
alter table scoring_rules enable row level security;
alter table manual_adjustments enable row level security;
alter table audit_log enable row level security;
alter table api_event_cache enable row level security;

create policy "Public read access" on managers for select using (true);
create policy "Public read access" on squad_assets for select using (true);
create policy "Public read access" on matches for select using (true);
create policy "Public read access" on fantasy_events for select using (true);
create policy "Public read access" on scoring_rules for select using (true);
create policy "Public read access" on manual_adjustments for select using (true);
create policy "Public read access" on audit_log for select using (true);
create policy "Public read access" on api_event_cache for select using (true);

-- No insert/update/delete policies are defined for anon/authenticated
-- roles, so all writes must use the Supabase service role key from a
-- trusted server context (API routes already gated by isAdminAuthenticated()).
