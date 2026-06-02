-- Skapar hela slutspelsbracket med korrekta starttider (UTC) och API-ID:n.
-- Lag är NULL tills API:et populerar dem efter gruppspelet.
-- Bracket r16 → r32 → QF → SF → Final/3rd är länkad direkt.
-- Kör i Supabase Dashboard → SQL Editor

WITH
-- ── r32: 16 matcher ─────────────────────────────────────────────
r32_insert AS (
  INSERT INTO matches (round, starts_at, home_source_is_winner, away_source_is_winner, api_match_id)
  VALUES
    ('r32', '2026-06-28T19:00:00+00:00', true, true, 537417),
    ('r32', '2026-06-29T17:00:00+00:00', true, true, 537423),
    ('r32', '2026-06-29T20:30:00+00:00', true, true, 537415),
    ('r32', '2026-06-30T01:00:00+00:00', true, true, 537418),
    ('r32', '2026-06-30T17:00:00+00:00', true, true, 537424),
    ('r32', '2026-06-30T21:00:00+00:00', true, true, 537416),
    ('r32', '2026-07-01T01:00:00+00:00', true, true, 537425),
    ('r32', '2026-07-01T16:00:00+00:00', true, true, 537426),
    ('r32', '2026-07-01T20:00:00+00:00', true, true, 537422),
    ('r32', '2026-07-02T00:00:00+00:00', true, true, 537421),
    ('r32', '2026-07-02T19:00:00+00:00', true, true, 537420),
    ('r32', '2026-07-02T23:00:00+00:00', true, true, 537419),
    ('r32', '2026-07-03T03:00:00+00:00', true, true, 537429),
    ('r32', '2026-07-03T18:00:00+00:00', true, true, 537428),
    ('r32', '2026-07-03T22:00:00+00:00', true, true, 537427),
    ('r32', '2026-07-04T01:30:00+00:00', true, true, 537430)
  RETURNING id, starts_at
),
r32_n AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY starts_at) AS n FROM r32_insert
),

-- ── r16: 8 matcher ──────────────────────────────────────────────
r16_insert AS (
  INSERT INTO matches (round, starts_at, home_source_match_id, away_source_match_id, home_source_is_winner, away_source_is_winner, api_match_id)
  SELECT 'r16', t, h.id, a.id, true, true, api_id
  FROM (VALUES
    ('2026-07-04T17:00:00+00:00'::timestamptz,  1,  2, 537376),
    ('2026-07-04T21:00:00+00:00'::timestamptz,  3,  4, 537375),
    ('2026-07-05T20:00:00+00:00'::timestamptz,  5,  6, 537377),
    ('2026-07-06T00:00:00+00:00'::timestamptz,  7,  8, 537378),
    ('2026-07-06T19:00:00+00:00'::timestamptz,  9, 10, 537379),
    ('2026-07-07T00:00:00+00:00'::timestamptz, 11, 12, 537380),
    ('2026-07-07T16:00:00+00:00'::timestamptz, 13, 14, 537381),
    ('2026-07-07T20:00:00+00:00'::timestamptz, 15, 16, 537382)
  ) AS slots(t, hn, an, api_id)
  JOIN r32_n h ON h.n = slots.hn
  JOIN r32_n a ON a.n = slots.an
  RETURNING id, starts_at
),
r16_n AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY starts_at) AS n FROM r16_insert
),

-- ── QF: 4 matcher ───────────────────────────────────────────────
qf_insert AS (
  INSERT INTO matches (round, starts_at, home_source_match_id, away_source_match_id, home_source_is_winner, away_source_is_winner, api_match_id)
  SELECT 'qf', t, h.id, a.id, true, true, api_id
  FROM (VALUES
    ('2026-07-09T20:00:00+00:00'::timestamptz, 1, 2, 537383),
    ('2026-07-10T19:00:00+00:00'::timestamptz, 3, 4, 537384),
    ('2026-07-11T21:00:00+00:00'::timestamptz, 5, 6, 537385),
    ('2026-07-12T01:00:00+00:00'::timestamptz, 7, 8, 537386)
  ) AS slots(t, hn, an, api_id)
  JOIN r16_n h ON h.n = slots.hn
  JOIN r16_n a ON a.n = slots.an
  RETURNING id, starts_at
),
qf_n AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY starts_at) AS n FROM qf_insert
),

-- ── SF: 2 matcher ───────────────────────────────────────────────
sf_insert AS (
  INSERT INTO matches (round, starts_at, home_source_match_id, away_source_match_id, home_source_is_winner, away_source_is_winner, api_match_id)
  SELECT 'sf', t, h.id, a.id, true, true, api_id
  FROM (VALUES
    ('2026-07-14T19:00:00+00:00'::timestamptz, 1, 2, 537387),
    ('2026-07-15T19:00:00+00:00'::timestamptz, 3, 4, 537388)
  ) AS slots(t, hn, an, api_id)
  JOIN qf_n h ON h.n = slots.hn
  JOIN qf_n a ON a.n = slots.an
  RETURNING id, starts_at
),
sf_n AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY starts_at) AS n FROM sf_insert
),

-- ── Bronsmatch ──────────────────────────────────────────────────
third_insert AS (
  INSERT INTO matches (round, starts_at, home_source_match_id, away_source_match_id, home_source_is_winner, away_source_is_winner, api_match_id)
  SELECT '3rd', '2026-07-18T21:00:00+00:00', h.id, a.id, false, false, 537389
  FROM sf_n h JOIN sf_n a ON h.n = 1 AND a.n = 2
  RETURNING id
),

-- ── Final ───────────────────────────────────────────────────────
final_insert AS (
  INSERT INTO matches (round, starts_at, home_source_match_id, away_source_match_id, home_source_is_winner, away_source_is_winner, api_match_id)
  SELECT 'final', '2026-07-19T19:00:00+00:00', h.id, a.id, true, true, 537390
  FROM sf_n h JOIN sf_n a ON h.n = 1 AND a.n = 2
  RETURNING id
)

SELECT
  (SELECT count(*) FROM r32_insert) AS r32,
  (SELECT count(*) FROM r16_insert) AS r16,
  (SELECT count(*) FROM qf_insert)  AS qf,
  (SELECT count(*) FROM sf_insert)  AS sf,
  (SELECT count(*) FROM third_insert) AS "3rd",
  (SELECT count(*) FROM final_insert) AS final;
