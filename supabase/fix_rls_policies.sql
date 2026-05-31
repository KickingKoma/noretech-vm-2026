-- Migration: RLS-policies med deadline-kontroll på databasnivå
-- Kör detta i Supabase Dashboard → SQL Editor

-- ── Matches: rätt admin-email ────────────────────────────────
drop policy if exists "Matches: admin kan allt" on matches;

create policy "Matches: admin kan allt"
  on matches for all using (auth.email() = 'kimalmgren@hotmail.com');


-- ── Tips: ta bort gamla osäkra policies ──────────────────────
drop policy if exists "Tips: spara eget tips (deadline-kontroll sker i frontend)" on tips;
drop policy if exists "Tips: uppdatera eget tips" on tips;
drop policy if exists "Tips: alla inloggade kan läsa" on tips;


-- ── Tips: INSERT – blockeras efter deadline ───────────────────
-- Gruppspel: stänger när första gruppspelets match startar
-- Slutspel:  stänger när första r32-matchen startar
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


-- ── Tips: UPDATE – samma deadline som insert ──────────────────
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


-- ── Tips: SELECT – egna alltid, andras först efter deadline ───
-- Förhindrar att man läser ut andras tips och retroaktivt ändrar sina egna
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
