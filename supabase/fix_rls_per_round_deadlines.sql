-- Migration: per-omgångs deadline för slutspelstips
-- Tidigare låste alla slutspelsrundor när r32 startade.
-- Nu låser varje runda sig individuellt när dess första match startar.
-- Kör i Supabase Dashboard → SQL Editor

drop policy if exists "Tips: insert med deadline" on tips;
drop policy if exists "Tips: update med deadline" on tips;
drop policy if exists "Tips: ta bort eget tips" on tips;
drop policy if exists "Tips: las egna alltid, andras efter deadline" on tips;


-- ── INSERT ────────────────────────────────────────────────────
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
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round = m.round AND starts_at <= now()))
      )
    )
  );


-- ── UPDATE ────────────────────────────────────────────────────
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
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round = m.round AND starts_at <= now()))
      )
    )
  );


-- ── DELETE ────────────────────────────────────────────────────
create policy "Tips: ta bort eget tips"
  on tips for delete using (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
      AND (
        (m.round LIKE 'group-%'
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now()))
        OR
        (m.round NOT LIKE 'group-%'
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round = m.round AND starts_at <= now()))
      )
    )
  );


-- ── SELECT ────────────────────────────────────────────────────
create policy "Tips: las egna alltid, andras efter deadline"
  on tips for select using (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = tips.match_id
      AND (
        m.home_score IS NOT NULL
        OR (
          m.round LIKE 'group-%'
          AND EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now())
        )
        OR (
          m.round NOT LIKE 'group-%'
          AND EXISTS (SELECT 1 FROM matches WHERE round = m.round AND starts_at <= now())
        )
      )
    )
  );
