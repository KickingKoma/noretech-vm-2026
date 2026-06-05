-- Kör i Supabase Dashboard → SQL Editor
-- Förutsätter att pg_cron och pg_net är aktiverade under Database → Extensions

-- Schemalägg sync-results Edge Function var 2:e minut
-- Ersätt <ANON_KEY> med projektets anon-nyckel (finns under Project Settings → API)
select cron.schedule(
  'sync-results',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://ibprecowlcrrtvofayul.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Kontrollera att jobbet skapades:
-- select * from cron.job;

-- Ta bort jobbet vid behov:
-- select cron.unschedule('sync-results');
