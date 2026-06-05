-- Lägger till status-kolumn på matches för live-score-stöd
-- Värden: SCHEDULED, IN_PLAY, PAUSED, FINISHED
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status text DEFAULT 'SCHEDULED';

-- Backfyll befintliga avgjorda matcher
UPDATE matches SET status = 'FINISHED' WHERE home_score IS NOT NULL;
