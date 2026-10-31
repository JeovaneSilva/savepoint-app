-- Profiles (public nickname) + ranking.
-- Nobody can read other people's rows directly: the ranking is served by a SECURITY DEFINER function
-- that returns only the nickname and aggregate numbers (never emails, ids or the game list).

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_nickname_format CHECK (nickname ~ '^[\w.-]{3,20}$')
);

-- Nicknames are unique ignoring case ("Neo" and "neo" are the same).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_lower_key ON public.profiles (lower(nickname));

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- set_updated_at() already exists (created with user_games).
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sign-up: the app sends the nickname in the user metadata; create the profile right away.
-- Never fails the sign-up: if the nickname is missing/invalid/taken, the app asks for one on first login.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nick text := nullif(btrim(NEW.raw_user_meta_data ->> 'nickname'), '');
BEGIN
  IF nick IS NOT NULL THEN
    BEGIN
      INSERT INTO public.profiles (user_id, nickname) VALUES (NEW.id, nick);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Is this nickname free? (callable before sign-up; the caller's own nickname counts as free.)
CREATE OR REPLACE FUNCTION public.nickname_available(p_nickname text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(nickname) = lower(btrim(p_nickname))
      AND user_id IS DISTINCT FROM auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.nickname_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nickname_available(text) TO anon, authenticated;

-- Ranking: one row per person with a profile (zeros included).
-- completed_year counts games completed in p_year (by completion date).
CREATE OR REPLACE FUNCTION public.get_ranking(p_year integer)
RETURNS TABLE (
  nickname text,
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
    COUNT(g.id) FILTER (WHERE g.status = 'concluido')::integer AS completed_total,
    COUNT(g.id) FILTER (
      WHERE g.status = 'concluido'
        AND g.completed_at >= make_date(p_year, 1, 1)
        AND g.completed_at < make_date(p_year + 1, 1, 1)
    )::integer AS completed_year,
    COUNT(g.id)::integer AS library_total,
    (p.user_id = auth.uid()) AS is_me
  FROM public.profiles p
  LEFT JOIN public.user_games g ON g.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
  GROUP BY p.user_id, p.nickname;
$$;

REVOKE ALL ON FUNCTION public.get_ranking(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking(integer) TO authenticated;
