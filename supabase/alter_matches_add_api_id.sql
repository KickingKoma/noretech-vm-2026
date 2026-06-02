-- Lägger till api_match_id för säker matchning mot football-data.org
-- Kör i Supabase Dashboard → SQL Editor

ALTER TABLE matches ADD COLUMN IF NOT EXISTS api_match_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS matches_api_match_id_idx ON matches (api_match_id) WHERE api_match_id IS NOT NULL;
