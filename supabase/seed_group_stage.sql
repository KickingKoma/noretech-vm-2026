-- VM 2026 – Gruppspelsmatcher (alla 72 matcher)
-- Tider i UTC. Källa: football-data.org (API-verifierad)
-- Kör i Supabase Dashboard → SQL Editor

INSERT INTO matches (home_team, away_team, starts_at, round) VALUES

-- ========== GRUPP A ==========
('Mexico',      'South Africa', '2026-06-11 19:00:00+00', 'group-A'),
('South Korea', 'Tjeckien',     '2026-06-12 02:00:00+00', 'group-A'),
('Tjeckien',    'South Africa', '2026-06-18 16:00:00+00', 'group-A'),
('Mexico',      'South Korea',  '2026-06-19 01:00:00+00', 'group-A'),
('Tjeckien',    'Mexico',       '2026-06-25 01:00:00+00', 'group-A'),
('South Africa','South Korea',  '2026-06-25 01:00:00+00', 'group-A'),

-- ========== GRUPP B ==========
('Canada',  'Bosnien-Hercegovina', '2026-06-12 19:00:00+00', 'group-B'),
('Qatar',   'Schweiz',             '2026-06-13 19:00:00+00', 'group-B'),
('Schweiz', 'Bosnien-Hercegovina', '2026-06-18 19:00:00+00', 'group-B'),
('Canada',  'Qatar',               '2026-06-18 22:00:00+00', 'group-B'),
('Schweiz', 'Canada',              '2026-06-24 19:00:00+00', 'group-B'),
('Bosnien-Hercegovina', 'Qatar',   '2026-06-24 19:00:00+00', 'group-B'),

-- ========== GRUPP C ==========
('Brasilien', 'Marocko',   '2026-06-13 22:00:00+00', 'group-C'),
('Haiti',     'Skottland', '2026-06-14 01:00:00+00', 'group-C'),
('Skottland', 'Marocko',   '2026-06-19 22:00:00+00', 'group-C'),
('Brasilien', 'Haiti',     '2026-06-20 00:30:00+00', 'group-C'),
('Skottland', 'Brasilien', '2026-06-24 22:00:00+00', 'group-C'),
('Marocko',   'Haiti',     '2026-06-24 22:00:00+00', 'group-C'),

-- ========== GRUPP D ==========
('USA',       'Paraguay',  '2026-06-13 01:00:00+00', 'group-D'),
('Australien','Turkiet',   '2026-06-14 04:00:00+00', 'group-D'),
('USA',       'Australien','2026-06-19 19:00:00+00', 'group-D'),
('Turkiet',   'Paraguay',  '2026-06-20 03:00:00+00', 'group-D'),
('Turkiet',   'USA',       '2026-06-26 02:00:00+00', 'group-D'),
('Paraguay',  'Australien','2026-06-26 02:00:00+00', 'group-D'),

-- ========== GRUPP E ==========
('Tyskland',        'Curaçao',          '2026-06-14 17:00:00+00', 'group-E'),
('Elfenbenskusten', 'Ecuador',          '2026-06-14 23:00:00+00', 'group-E'),
('Tyskland',        'Elfenbenskusten',  '2026-06-20 20:00:00+00', 'group-E'),
('Ecuador',         'Curaçao',          '2026-06-21 00:00:00+00', 'group-E'),
('Ecuador',         'Tyskland',         '2026-06-25 20:00:00+00', 'group-E'),
('Curaçao',         'Elfenbenskusten',  '2026-06-25 20:00:00+00', 'group-E'),

-- ========== GRUPP F ==========
('Nederländerna', 'Japan',          '2026-06-14 20:00:00+00', 'group-F'),
('Sverige',       'Tunisien',       '2026-06-15 02:00:00+00', 'group-F'),
('Nederländerna', 'Sverige',        '2026-06-20 17:00:00+00', 'group-F'),
('Tunisien',      'Japan',          '2026-06-21 04:00:00+00', 'group-F'),
('Tunisien',      'Nederländerna',  '2026-06-25 23:00:00+00', 'group-F'),
('Japan',         'Sverige',        '2026-06-25 23:00:00+00', 'group-F'),

-- ========== GRUPP G ==========
('Belgien',    'Egypten',     '2026-06-15 19:00:00+00', 'group-G'),
('Iran',       'Nya Zeeland', '2026-06-16 01:00:00+00', 'group-G'),
('Belgien',    'Iran',        '2026-06-21 19:00:00+00', 'group-G'),
('Nya Zeeland','Egypten',     '2026-06-22 01:00:00+00', 'group-G'),
('Nya Zeeland','Belgien',     '2026-06-27 03:00:00+00', 'group-G'),
('Egypten',    'Iran',        '2026-06-27 03:00:00+00', 'group-G'),

-- ========== GRUPP H ==========
('Spanien',     'Kap Verde',   '2026-06-15 16:00:00+00', 'group-H'),
('Saudiarabien','Uruguay',     '2026-06-15 22:00:00+00', 'group-H'),
('Spanien',     'Saudiarabien','2026-06-21 16:00:00+00', 'group-H'),
('Uruguay',     'Kap Verde',   '2026-06-21 22:00:00+00', 'group-H'),
('Uruguay',     'Spanien',     '2026-06-27 00:00:00+00', 'group-H'),
('Kap Verde',   'Saudiarabien','2026-06-27 00:00:00+00', 'group-H'),

-- ========== GRUPP I ==========
('Frankrike', 'Senegal', '2026-06-16 19:00:00+00', 'group-I'),
('Irak',      'Norge',   '2026-06-16 22:00:00+00', 'group-I'),
('Frankrike', 'Irak',    '2026-06-22 21:00:00+00', 'group-I'),
('Norge',     'Senegal', '2026-06-23 00:00:00+00', 'group-I'),
('Norge',     'Frankrike','2026-06-26 19:00:00+00', 'group-I'),
('Senegal',   'Irak',    '2026-06-26 19:00:00+00', 'group-I'),

-- ========== GRUPP J ==========
('Argentina', 'Algeriet', '2026-06-17 01:00:00+00', 'group-J'),
('Österrike', 'Jordanien','2026-06-17 04:00:00+00', 'group-J'),
('Argentina', 'Österrike','2026-06-22 17:00:00+00', 'group-J'),
('Jordanien', 'Algeriet', '2026-06-23 03:00:00+00', 'group-J'),
('Jordanien', 'Argentina','2026-06-28 02:00:00+00', 'group-J'),
('Algeriet',  'Österrike','2026-06-28 02:00:00+00', 'group-J'),

-- ========== GRUPP K ==========
('Portugal',  'DR Kongo',  '2026-06-17 17:00:00+00', 'group-K'),
('Uzbekistan','Colombia',  '2026-06-18 02:00:00+00', 'group-K'),
('Portugal',  'Uzbekistan','2026-06-23 17:00:00+00', 'group-K'),
('Colombia',  'DR Kongo',  '2026-06-24 02:00:00+00', 'group-K'),
('Colombia',  'Portugal',  '2026-06-27 23:30:00+00', 'group-K'),
('DR Kongo',  'Uzbekistan','2026-06-27 23:30:00+00', 'group-K'),

-- ========== GRUPP L ==========
('England', 'Kroatien', '2026-06-17 20:00:00+00', 'group-L'),
('Ghana',   'Panama',   '2026-06-17 23:00:00+00', 'group-L'),
('England', 'Ghana',    '2026-06-23 20:00:00+00', 'group-L'),
('Panama',  'Kroatien', '2026-06-23 23:00:00+00', 'group-L'),
('Panama',  'England',  '2026-06-27 21:00:00+00', 'group-L'),
('Kroatien','Ghana',    '2026-06-27 21:00:00+00', 'group-L');
