-- Badges ("selos"), profile photos and public profile functions.
--
-- Badges are defined in a table (`badges`): change a threshold or add a badge with plain SQL, no app update.
-- They are awarded by triggers on user_games and never revoked. Users cannot write badges themselves.
-- Other people's profiles are served by SECURITY DEFINER functions that return only: nickname, photo,
-- totals, earned badges and the last completed games (name + cover + date). Never ratings, notes or emails.

/* ---------------- Profile photo ---------------- */

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz;

-- A profile may only point at a file inside its own folder.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_path_own_folder;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_path_own_folder
  CHECK (avatar_path IS NULL OR avatar_path LIKE user_id::text || '/%');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Files live in a folder named after the user id: <user_id>/avatar.jpg. Reads are public (public bucket).
DROP POLICY IF EXISTS "Avatars: upload own" ON storage.objects;
CREATE POLICY "Avatars: upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Needed by upload(..., { upsert: true }): Storage checks read access to see if the file already exists.
-- Only the owner's folder; public URLs keep working because the bucket is public.
DROP POLICY IF EXISTS "Avatars: read own" ON storage.objects;
CREATE POLICY "Avatars: read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars: update own" ON storage.objects;
CREATE POLICY "Avatars: update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars: delete own" ON storage.objects;
CREATE POLICY "Avatars: delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

/* ---------------- Badge catalog ---------------- */

CREATE TABLE IF NOT EXISTS public.badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,            -- lucide icon name, mapped in the app
  tier text NOT NULL CHECK (tier IN ('bronze', 'prata', 'ouro', 'platina')),
  metric text NOT NULL,          -- one of the metrics returned by user_metrics()
  threshold numeric NOT NULL,
  sort integer NOT NULL
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.badges FROM anon;
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
DROP POLICY IF EXISTS "Anyone signed in can read badges" ON public.badges;
CREATE POLICY "Anyone signed in can read badges" ON public.badges FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  badge_id text NOT NULL REFERENCES public.badges (id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_badges FROM anon;
GRANT SELECT ON public.user_badges TO authenticated;     -- read-only: only the triggers write
GRANT ALL ON public.user_badges TO service_role;
DROP POLICY IF EXISTS "Users view own badges" ON public.user_badges;
CREATE POLICY "Users view own badges" ON public.user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.badges (id, name, description, icon, tier, metric, threshold, sort) VALUES
  -- Games completed
  ('zerados_1',   'Primeiro Zerado',   'Zere seu primeiro jogo',                    'Trophy',    'bronze',  'completed_total', 1,   10),
  ('zerados_10',  'Veterano',          'Zere 10 jogos',                             'Medal',     'prata',   'completed_total', 10,  11),
  ('zerados_25',  'Mestre dos Jogos',  'Zere 25 jogos',                             'Award',     'ouro',    'completed_total', 25,  12),
  ('zerados_50',  'Lenda',             'Zere 50 jogos',                             'Crown',     'platina', 'completed_total', 50,  13),
  ('zerados_100', 'Imortal',           'Zere 100 jogos',                            'Gem',       'platina', 'completed_total', 100, 14),
  -- Hours (only games with hours filled in)
  ('horas_10',    'Quebrando o Gelo',  'Some 10 horas em jogos zerados',            'Clock',     'bronze',  'hours_total',     10,  20),
  ('horas_100',   'Maratonista',       'Some 100 horas em jogos zerados',           'Timer',     'prata',   'hours_total',     100, 21),
  ('horas_250',   'Vida Gamer',        'Some 250 horas em jogos zerados',           'Flame',     'ouro',    'hours_total',     250, 22),
  ('horas_500',   'Sem Hora pra Dormir','Some 500 horas em jogos zerados',          'Moon',      'platina', 'hours_total',     500, 23),
  -- Pace
  ('mes_3',       'Maratona do Mês',   'Zere 3 jogos no mesmo mês',                 'Zap',       'prata',   'completed_month_max', 3,  30),
  ('ano_12',      'Um por Mês',        'Zere 12 jogos no mesmo ano',                'CalendarCheck', 'ouro', 'completed_year_max', 12, 31),
  -- Variety
  ('retro_1',     'Retrô Raiz',        'Zere um jogo lançado até o ano 2000',       'Gamepad2',  'bronze',  'classics_completed', 1, 40),
  ('retro_5',     'Arqueólogo Gamer',  'Zere 5 jogos lançados até o ano 2000',      'Pickaxe',   'prata',   'classics_completed', 5, 41),
  ('plataformas_3','Multiplataforma',  'Jogue em 3 plataformas diferentes',         'Layers',    'bronze',  'platforms_distinct', 3, 42),
  ('generos_5',   'Eclético',          'Zere jogos de 5 gêneros diferentes',        'Shapes',    'prata',   'genres_completed',   5, 43),
  -- Library habits
  ('colecao_25',  'Colecionador',      'Tenha 25 jogos na biblioteca',              'Library',   'bronze',  'library_total',   25,  50),
  ('colecao_100', 'Biblioteca de Alexandria','Tenha 100 jogos na biblioteca',       'Landmark',  'ouro',    'library_total',   100, 51),
  ('critico_10',  'Crítico',           'Dê nota a 10 jogos',                        'Star',      'prata',   'ratings_given',   10,  52),
  ('diario_5',    'Diário de Bordo',   'Escreva anotações em 5 jogos',              'BookOpen',  'bronze',  'notes_written',   5,   53)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, tier = EXCLUDED.tier,
  metric = EXCLUDED.metric, threshold = EXCLUDED.threshold, sort = EXCLUDED.sort;

/* ---------------- Metrics + awarding ---------------- */

-- Internal: the numbers badges are measured against. Not callable by app users.
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

CREATE OR REPLACE FUNCTION public.award_badges(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT p_user, b.id
  FROM public.badges b
  JOIN public.user_metrics(p_user) m ON m.metric = b.metric
  WHERE m.value >= b.threshold
  ON CONFLICT DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.award_badges(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_badges(uuid) TO service_role;

-- Statement-level triggers: one pass per statement (an import of 100 games runs this once, not 100 times).
CREATE OR REPLACE FUNCTION public.award_badges_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM new_rows LOOP
    PERFORM public.award_badges(u);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_games_award_badges_ins ON public.user_games;
CREATE TRIGGER user_games_award_badges_ins
AFTER INSERT ON public.user_games
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.award_badges_after_change();

DROP TRIGGER IF EXISTS user_games_award_badges_upd ON public.user_games;
CREATE TRIGGER user_games_award_badges_upd
AFTER UPDATE ON public.user_games
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.award_badges_after_change();

-- Give everyone the badges they already deserve.
SELECT public.award_badges(u.user_id) FROM (SELECT DISTINCT user_id FROM public.user_games) u;

/* ---------------- Functions used by the app ---------------- */

-- My badges: every badge with my current progress (earned_at is null while locked).
CREATE OR REPLACE FUNCTION public.get_my_badges()
RETURNS TABLE (
  id text, name text, description text, icon text, tier text,
  threshold numeric, progress numeric, earned_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.description, b.icon, b.tier, b.threshold,
         coalesce(m.value, 0) AS progress, ub.earned_at
  FROM public.badges b
  LEFT JOIN public.user_metrics(auth.uid()) m ON m.metric = b.metric
  LEFT JOIN public.user_badges ub ON ub.badge_id = b.id AND ub.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
  ORDER BY b.sort;
$$;

REVOKE ALL ON FUNCTION public.get_my_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_badges() TO authenticated;

-- Public profile summary, found by nickname (case-insensitive).
CREATE OR REPLACE FUNCTION public.get_profile(p_nickname text)
RETURNS TABLE (
  nickname text, avatar_path text, avatar_updated_at timestamptz, member_since timestamptz,
  completed_total integer, hours_total numeric, library_total integer, badges_total integer, is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.nickname, p.avatar_path, p.avatar_updated_at, p.created_at,
    (SELECT count(*) FROM public.user_games g WHERE g.user_id = p.user_id AND g.status = 'concluido')::integer,
    (SELECT coalesce(sum(g.hours_played), 0) FROM public.user_games g WHERE g.user_id = p.user_id AND g.status = 'concluido')::numeric,
    (SELECT count(*) FROM public.user_games g WHERE g.user_id = p.user_id)::integer,
    (SELECT count(*) FROM public.user_badges ub WHERE ub.user_id = p.user_id)::integer,
    (p.user_id = auth.uid())
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND lower(p.nickname) = lower(btrim(p_nickname));
$$;

REVOKE ALL ON FUNCTION public.get_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile(text) TO authenticated;

-- Badges someone has earned (what other people may see).
CREATE OR REPLACE FUNCTION public.get_profile_badges(p_nickname text)
RETURNS TABLE (id text, name text, description text, icon text, tier text, earned_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.description, b.icon, b.tier, ub.earned_at
  FROM public.profiles p
  JOIN public.user_badges ub ON ub.user_id = p.user_id
  JOIN public.badges b ON b.id = ub.badge_id
  WHERE auth.uid() IS NOT NULL AND lower(p.nickname) = lower(btrim(p_nickname))
  ORDER BY b.sort;
$$;

REVOKE ALL ON FUNCTION public.get_profile_badges(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_badges(text) TO authenticated;

-- Last completed games: name, cover and date only (no rating, notes or platform).
CREATE OR REPLACE FUNCTION public.get_profile_recent(p_nickname text)
RETURNS TABLE (rawg_id integer, name text, cover_url text, completed_at date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.rawg_id, g.name, g.cover_url, g.completed_at
  FROM public.profiles p
  JOIN public.user_games g ON g.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL AND lower(p.nickname) = lower(btrim(p_nickname)) AND g.status = 'concluido'
  ORDER BY g.completed_at DESC NULLS LAST, g.updated_at DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_profile_recent(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_recent(text) TO authenticated;

-- Ranking now also returns the photo (the app opens a profile by nickname, so no ids are exposed).
DROP FUNCTION IF EXISTS public.get_ranking(integer);
CREATE FUNCTION public.get_ranking(p_year integer)
RETURNS TABLE (
  nickname text,
  avatar_path text,
  avatar_updated_at timestamptz,
  completed_total integer,
  completed_year integer,
  library_total integer,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.nickname,
    p.avatar_path,
    p.avatar_updated_at,
    COUNT(g.id) FILTER (WHERE g.status = 'concluido')::integer,
    COUNT(g.id) FILTER (
      WHERE g.status = 'concluido'
        AND g.completed_at >= make_date(p_year, 1, 1)
        AND g.completed_at < make_date(p_year + 1, 1, 1)
    )::integer,
    COUNT(g.id)::integer,
    (p.user_id = auth.uid())
  FROM public.profiles p
  LEFT JOIN public.user_games g ON g.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
  GROUP BY p.user_id, p.nickname, p.avatar_path, p.avatar_updated_at;
$$;

REVOKE ALL ON FUNCTION public.get_ranking(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking(integer) TO authenticated;
