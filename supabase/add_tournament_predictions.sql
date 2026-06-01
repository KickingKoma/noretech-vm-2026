-- VM 2026 – Topp 3-tippning
-- Kör i Supabase Dashboard → SQL Editor

create table if not exists tournament_predictions (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null unique,
  first_place  text not null,
  second_place text not null,
  third_place  text not null,
  created_at   timestamptz default now()
);

alter table tournament_predictions enable row level security;

create policy "Predictions: läs egna alltid, andras efter deadline"
  on tournament_predictions for select using (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now())
  );

create policy "Predictions: insert innan deadline"
  on tournament_predictions for insert with check (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now())
  );

create policy "Predictions: update innan deadline"
  on tournament_predictions for update using (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM matches WHERE round LIKE 'group-%' AND starts_at <= now())
  );

create policy "Predictions: ta bort eget"
  on tournament_predictions for delete using (auth.uid() = user_id);
