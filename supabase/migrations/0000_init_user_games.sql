CREATE TYPE public.game_status AS ENUM ('concluido', 'jogando', 'quero_jogar', 'abandonado');

CREATE TABLE public.user_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rawg_id integer NOT NULL,
  name text NOT NULL,
  cover_url text,
  release_year integer,
  platforms text[] NOT NULL DEFAULT '{}',
  played_on text,
  genres text[] NOT NULL DEFAULT '{}',
  status public.game_status NOT NULL DEFAULT 'quero_jogar',
  rating integer CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  completed_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_games_user_rawg_unique UNIQUE (user_id, rawg_id)
);

CREATE INDEX user_games_user_id_idx ON public.user_games (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_games TO authenticated;
GRANT ALL ON public.user_games TO service_role;

ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own games" ON public.user_games
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own games" ON public.user_games
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own games" ON public.user_games
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own games" ON public.user_games
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_games_set_updated_at
BEFORE UPDATE ON public.user_games
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();