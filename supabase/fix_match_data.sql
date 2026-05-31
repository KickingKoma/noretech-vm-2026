-- Patchar live-databasen med korrekta hemma/borta-ordningar och tider.
-- Källa: football-data.org (verifierad 2026-05-31)
-- Kör i Supabase Dashboard → SQL Editor

-- ============================================================
-- DEL 1: Hemma/borta-swap (6 matcher)
-- Swappar home_team/away_team i matches OCH home_tip/away_tip
-- i tips för att hålla poängräkningen korrekt.
-- ============================================================

-- Grupp A: Mexico–Tjeckien → Tjeckien–Mexico
WITH upd AS (
  UPDATE matches SET home_team = 'Tjeckien', away_team = 'Mexico'
  WHERE home_team = 'Mexico' AND away_team = 'Tjeckien' AND round = 'group-A'
  RETURNING id
)
UPDATE tips SET home_tip = away_tip, away_tip = home_tip
WHERE match_id IN (SELECT id FROM upd);

-- Grupp A: South Korea–South Africa → South Africa–South Korea
WITH upd AS (
  UPDATE matches SET home_team = 'South Africa', away_team = 'South Korea'
  WHERE home_team = 'South Korea' AND away_team = 'South Africa' AND round = 'group-A'
  RETURNING id
)
UPDATE tips SET home_tip = away_tip, away_tip = home_tip
WHERE match_id IN (SELECT id FROM upd);

-- Grupp C: Brasilien–Skottland → Skottland–Brasilien
WITH upd AS (
  UPDATE matches SET home_team = 'Skottland', away_team = 'Brasilien'
  WHERE home_team = 'Brasilien' AND away_team = 'Skottland' AND round = 'group-C'
  RETURNING id
)
UPDATE tips SET home_tip = away_tip, away_tip = home_tip
WHERE match_id IN (SELECT id FROM upd);

-- Grupp F: Tunisien–Sverige → Sverige–Tunisien
WITH upd AS (
  UPDATE matches SET home_team = 'Sverige', away_team = 'Tunisien'
  WHERE home_team = 'Tunisien' AND away_team = 'Sverige' AND round = 'group-F'
  RETURNING id
)
UPDATE tips SET home_tip = away_tip, away_tip = home_tip
WHERE match_id IN (SELECT id FROM upd);

-- Grupp J: Argentina–Jordanien → Jordanien–Argentina
WITH upd AS (
  UPDATE matches SET home_team = 'Jordanien', away_team = 'Argentina'
  WHERE home_team = 'Argentina' AND away_team = 'Jordanien' AND round = 'group-J'
  RETURNING id
)
UPDATE tips SET home_tip = away_tip, away_tip = home_tip
WHERE match_id IN (SELECT id FROM upd);

-- Grupp D: USA–Turkiet → Turkiet–USA
WITH upd AS (
  UPDATE matches SET home_team = 'Turkiet', away_team = 'USA'
  WHERE home_team = 'USA' AND away_team = 'Turkiet' AND round = 'group-D'
  RETURNING id
)
UPDATE tips SET home_tip = away_tip, away_tip = home_tip
WHERE match_id IN (SELECT id FROM upd);

-- ============================================================
-- DEL 2: Datumkorrigeringar (6 matcher)
-- ============================================================

-- Grupp C: Skottland–Marocko (19:00 → 22:00)
UPDATE matches SET starts_at = '2026-06-19 22:00:00+00'
WHERE home_team = 'Skottland' AND away_team = 'Marocko' AND round = 'group-C';

-- Grupp C: Brasilien–Haiti (01:00 → 00:30)
UPDATE matches SET starts_at = '2026-06-20 00:30:00+00'
WHERE home_team = 'Brasilien' AND away_team = 'Haiti' AND round = 'group-C';

-- Grupp D: Australien–Turkiet (Jun 13 → Jun 14)
UPDATE matches SET starts_at = '2026-06-14 04:00:00+00'
WHERE home_team = 'Australien' AND away_team = 'Turkiet' AND round = 'group-D';

-- Grupp D: Turkiet–Paraguay (Jun 19 04:00 → Jun 20 03:00)
UPDATE matches SET starts_at = '2026-06-20 03:00:00+00'
WHERE home_team = 'Turkiet' AND away_team = 'Paraguay' AND round = 'group-D';

-- Grupp F: Tunisien–Japan (Jun 20 → Jun 21)
UPDATE matches SET starts_at = '2026-06-21 04:00:00+00'
WHERE home_team = 'Tunisien' AND away_team = 'Japan' AND round = 'group-F';

-- Grupp J: Österrike–Jordanien (Jun 16 → Jun 17)
UPDATE matches SET starts_at = '2026-06-17 04:00:00+00'
WHERE home_team = 'Österrike' AND away_team = 'Jordanien' AND round = 'group-J';
