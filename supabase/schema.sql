-- VM-Tippning 2026 – Supabase schema
-- Kör detta i Supabase Dashboard → SQL Editor

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id            uuid references auth.users on delete cascade primary key,
  display_name  text not null,
  created_at    timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles: alla kan läsa"
  on profiles for select using (true);

create policy "Profiles: uppdatera egna"
  on profiles for update using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ============================================================
-- MATCHES
-- ============================================================
create table if not exists matches (
  id                      uuid default gen_random_uuid() primary key,

  -- Lag (null för knockout om lagen hämtas från source-matcher)
  home_team               text,
  away_team               text,

  -- Bracket-kedja: vilken match vinnaren/förloraren av x spelar
  home_source_match_id    uuid references matches(id),
  away_source_match_id    uuid references matches(id),
  home_source_is_winner   boolean not null default true,
  away_source_is_winner   boolean not null default true,

  starts_at               timestamptz not null,
  round                   text not null,  -- 'group-A'..'group-L', 'r32','r16','qf','sf','3rd','final'

  -- Resultat (admin fyller i efter match)
  home_score              int,
  away_score              int,
  winner_team             text,           -- vem som faktiskt gick vidare (knockout)

  created_at              timestamptz default now()
);

alter table matches enable row level security;

create policy "Matches: alla kan läsa"
  on matches for select using (true);

create policy "Matches: admin kan allt"
  on matches for all using (auth.email() = 'kimalmgren@hotmail.com');


-- ============================================================
-- TIPS
-- ============================================================
create table if not exists tips (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  match_id    uuid references matches on delete cascade not null,
  home_tip    int not null check (home_tip >= 0),
  away_tip    int not null check (away_tip >= 0),
  winner_tip  text,   -- vilket lag användaren tror vinner (obligatoriskt för knockout)
  created_at  timestamptz default now(),
  unique(user_id, match_id)
);

alter table tips enable row level security;

-- Egna tips syns alltid; andras tips syns först efter att deadline passerat
-- (dvs. när första matchen i respektive fas har startat)
create policy "Tips: las egna alltid, andras efter deadline"
  on tips for select using (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = tips.match_id
      AND (
        (m.round LIKE 'group-%'
         AND EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now()))
        OR
        (m.round NOT LIKE 'group-%'
         AND EXISTS (SELECT 1 FROM matches WHERE round = 'r32' AND starts_at <= now()))
      )
    )
  );

-- Insert och update blockeras på databasnivå efter deadline
create policy "Tips: insert med deadline"
  on tips for insert with check (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
      AND (
        (m.round LIKE 'group-%'
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now()))
        OR
        (m.round NOT LIKE 'group-%'
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round = 'r32' AND starts_at <= now()))
      )
    )
  );

create policy "Tips: update med deadline"
  on tips for update using (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
      AND (
        (m.round LIKE 'group-%'
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now()))
        OR
        (m.round NOT LIKE 'group-%'
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round = 'r32' AND starts_at <= now()))
      )
    )
  );

create policy "Tips: ta bort eget tips"
  on tips for delete using (auth.uid() = user_id);
