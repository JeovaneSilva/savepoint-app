-- New, harder badge catalog (31 badges) + a new metric (longest single game), then everyone's badges are
-- recalculated from scratch under the new rules. Badges earned under the old rules that no longer apply are gone.
-- Safe to run more than once.

/* ---------------- Metrics: add "longest completed game" ---------------- */

CREATE OR REPLACE FUNCTION public.user_metrics(p_user uuid)
RETURNS TABLE (metric text, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'completed_total'::text, count(*)::numeric
    FROM public.user_games WHERE user_id = p_user AND status = 'concluido'
  UNION ALL
  SELECT 'hours_total', coalesce(sum(hours_played), 0)::numeric
    FROM public.user_games WHERE user_id = p_user AND status = 'concluido'
  UNION ALL
  SELECT 'max_game_hours', coalesce(max(hours_played), 0)::numeric
    FROM public.user_games WHERE user_id = p_user AND status = 'concluido'
  UNION ALL
  SELECT 'library_total', count(*)::numeric
    FROM public.user_games WHERE user_id = p_user
  UNION ALL
  SELECT 'classics_completed', count(*)::numeric
    FROM public.user_games
    WHERE user_id = p_user AND status = 'concluido' AND release_year IS NOT NULL AND release_year <= 2000
  UNION ALL
  SELECT 'ratings_given', count(*)::numeric
    FROM public.user_games WHERE user_id = p_user AND rating IS NOT NULL
  UNION ALL
  SELECT 'notes_written', count(*)::numeric
    FROM public.user_games WHERE user_id = p_user AND notes IS NOT NULL AND btrim(notes) <> ''
  UNION ALL
  SELECT 'platforms_distinct', count(DISTINCT played_on)::numeric
    FROM public.user_games WHERE user_id = p_user AND played_on IS NOT NULL
  UNION ALL
  SELECT 'genres_completed', count(DISTINCT genre)::numeric
    FROM public.user_games g CROSS JOIN LATERAL unnest(g.genres) AS genre
    WHERE g.user_id = p_user AND g.status = 'concluido'
  UNION ALL
  SELECT 'completed_year_max', coalesce(max(c), 0)::numeric FROM (
    SELECT count(*) AS c FROM public.user_games
    WHERE user_id = p_user AND status = 'concluido' AND completed_at IS NOT NULL
    GROUP BY extract(year FROM completed_at)
  ) y
  UNION ALL
  SELECT 'completed_month_max', coalesce(max(c), 0)::numeric FROM (
    SELECT count(*) AS c FROM public.user_games
    WHERE user_id = p_user AND status = 'concluido' AND completed_at IS NOT NULL
    GROUP BY date_trunc('month', completed_at)
  ) m;
$$;

REVOKE ALL ON FUNCTION public.user_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_metrics(uuid) TO service_role;

/* ---------------- New catalog ---------------- */

-- Wipe earned badges and the old catalog (user_badges references badges).
DELETE FROM public.user_badges;
DELETE FROM public.badges;

INSERT INTO public.badges (id, name, description, icon, tier, metric, threshold, sort) VALUES
  -- Games completed
  ('zerados_1',     'Primeiro Zerado',          'Zere seu primeiro jogo',                       'Trophy',        'bronze',  'completed_total',     1,    10),
  ('zerados_5',     'Pegando o Jeito',          'Zere 5 jogos',                                 'Sparkles',      'bronze',  'completed_total',     5,    11),
  ('zerados_15',    'Veterano',                 'Zere 15 jogos',                                'Medal',         'prata',   'completed_total',     15,   12),
  ('zerados_35',    'Mestre dos Jogos',         'Zere 35 jogos',                                'Award',         'ouro',    'completed_total',     35,   13),
  ('zerados_75',    'Lenda',                    'Zere 75 jogos',                                'Crown',         'platina', 'completed_total',     75,   14),
  ('zerados_150',   'Imortal',                  'Zere 150 jogos',                               'Infinity',      'platina', 'completed_total',     150,  15),
  -- Hours (sum over completed games with hours filled in)
  ('horas_30',      'Aquecimento',              'Some 30 horas em jogos zerados',               'Clock',         'bronze',  'hours_total',         30,   20),
  ('horas_100',     'Maratonista',              'Some 100 horas em jogos zerados',              'Timer',         'prata',   'hours_total',         100,  21),
  ('horas_250',     'Vida Gamer',               'Some 250 horas em jogos zerados',              'Flame',         'ouro',    'hours_total',         250,  22),
  ('horas_500',     'Sem Hora pra Dormir',      'Some 500 horas em jogos zerados',              'Moon',          'platina', 'hours_total',         500,  23),
  ('horas_1000',    'Lenda das Horas',          'Some 1000 horas em jogos zerados',             'Hourglass',     'platina', 'hours_total',         1000, 24),
  -- A single long game
  ('jogo_40h',      'Jogo Longo',               'Zere um único jogo de 40 horas ou mais',       'Swords',        'prata',   'max_game_hours',      40,   30),
  ('jogo_80h',      'Épico',                    'Zere um único jogo de 80 horas ou mais',       'Mountain',      'ouro',    'max_game_hours',      80,   31),
  -- Pace
  ('mes_5',         'Maratona do Mês',          'Zere 5 jogos no mesmo mês',                    'Zap',           'prata',   'completed_month_max', 5,    40),
  ('mes_8',         'Maratona Insana',          'Zere 8 jogos no mesmo mês',                    'Rocket',        'ouro',    'completed_month_max', 8,    41),
  ('ano_12',        'Um por Mês',               'Zere 12 jogos no mesmo ano',                   'CalendarCheck', 'ouro',    'completed_year_max',  12,   42),
  ('ano_24',        'Dois por Mês',             'Zere 24 jogos no mesmo ano',                   'CalendarRange', 'platina', 'completed_year_max',  24,   43),
  -- Variety
  ('retro_1',       'Retrô Raiz',               'Zere um jogo lançado até o ano 2000',          'Gamepad2',      'bronze',  'classics_completed',  1,    50),
  ('retro_10',      'Arqueólogo Gamer',         'Zere 10 jogos lançados até o ano 2000',        'Pickaxe',       'prata',   'classics_completed',  10,   51),
  ('retro_25',      'Museu Vivo',               'Zere 25 jogos lançados até o ano 2000',        'Landmark',      'ouro',    'classics_completed',  25,   52),
  ('plataformas_3', 'Multiplataforma',          'Jogue em 3 plataformas diferentes',            'Layers',        'bronze',  'platforms_distinct',  3,    53),
  ('plataformas_6', 'Sem Fronteiras',           'Jogue em 6 plataformas diferentes',            'Globe',         'ouro',    'platforms_distinct',  6,    54),
  ('generos_6',     'Eclético',                 'Zere jogos de 6 gêneros diferentes',           'Shapes',        'prata',   'genres_completed',    6,    55),
  ('generos_12',    'Enciclopédia',             'Zere jogos de 12 gêneros diferentes',          'GraduationCap', 'ouro',    'genres_completed',    12,   56),
  -- Library habits
  ('colecao_25',    'Colecionador',             'Tenha 25 jogos na biblioteca',                 'Library',       'bronze',  'library_total',       25,   60),
  ('colecao_100',   'Biblioteca de Alexandria', 'Tenha 100 jogos na biblioteca',                'Archive',       'ouro',    'library_total',       100,  61),
  ('colecao_250',   'Acervo Infinito',          'Tenha 250 jogos na biblioteca',                'Database',      'platina', 'library_total',       250,  62),
  ('critico_15',    'Crítico',                  'Dê nota a 15 jogos',                           'Star',          'bronze',  'ratings_given',       15,   63),
  ('critico_50',    'Crítico Implacável',       'Dê nota a 50 jogos',                           'Gavel',         'ouro',    'ratings_given',       50,   64),
  ('diario_5',      'Diário de Bordo',          'Escreva anotações em 5 jogos',                 'BookOpen',      'bronze',  'notes_written',       5,    65),
  ('diario_25',     'Cronista',                 'Escreva anotações em 25 jogos',                'ScrollText',    'prata',   'notes_written',       25,   66);

/* ---------------- Recalculate everyone from scratch ---------------- */

SELECT public.award_badges(u.user_id) FROM (SELECT DISTINCT user_id FROM public.user_games) u;
