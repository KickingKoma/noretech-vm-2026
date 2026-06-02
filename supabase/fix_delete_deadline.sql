-- Kör i Supabase Dashboard → SQL Editor
-- Lägger till deadlinecheck på DELETE så att tips inte kan raderas efter att tippning stängt.

drop policy if exists "Tips: ta bort eget tips" on tips;

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
         AND NOT EXISTS (SELECT 1 FROM matches WHERE round = 'r32' AND starts_at <= now()))
      )
    )
  );
