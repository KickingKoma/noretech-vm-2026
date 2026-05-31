-- Nollställ alla matchresultat men behåll matcher och tips
UPDATE matches SET home_score = NULL, away_score = NULL, winner_team = NULL;
