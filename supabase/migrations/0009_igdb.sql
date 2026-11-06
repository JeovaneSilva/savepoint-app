-- Move the game database from RAWG to IGDB.
--
-- Games are now identified by `igdb_id`. `rawg_id` stays (nullable) for rows that haven't been migrated yet, so the
-- old app keeps working while the new one rolls out. The one-time matching of existing games is done by the
-- `igdb` Edge Function (admin action `migrate`).

/* ---------------- user_games: new identifier ---------------- */

ALTER TABLE public.user_games ADD COLUMN IF NOT EXISTS igdb_id integer;
ALTER TABLE public.user_games ALTER COLUMN rawg_id DROP NOT NULL;

ALTER TABLE public.user_games DROP CONSTRAINT IF EXISTS user_games_has_game_id;
ALTER TABLE public.user_games
  ADD CONSTRAINT user_games_has_game_id CHECK (rawg_id IS NOT NULL OR igdb_id IS NOT NULL);

-- One entry per game per user. (user_id, rawg_id) is already unique; nulls don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS user_games_user_igdb_unique
  ON public.user_games (user_id, igdb_id) WHERE igdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_games_igdb_id_idx ON public.user_games (igdb_id);

/* ---------------- Profile "last completed": return both ids ---------------- */

-- Same function as in 0007 (approved accounts only, name + cover + date only), now also returning igdb_id.
-- rawg_id is kept in the result so the old app version keeps working.
DROP FUNCTION IF EXISTS public.get_profile_recent(text);
CREATE FUNCTION public.get_profile_recent(p_nickname text)
RETURNS TABLE (rawg_id integer, igdb_id integer, name text, cover_url text, completed_at date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.rawg_id, g.igdb_id, g.name, g.cover_url, g.completed_at
  FROM public.profiles p
  JOIN public.user_games g ON g.user_id = p.user_id
  WHERE public.is_approved()
    AND lower(p.nickname) = lower(btrim(p_nickname))
    AND g.status = 'concluido'
    AND EXISTS (SELECT 1 FROM public.account_approvals a WHERE a.user_id = p.user_id AND a.status = 'approved')
  ORDER BY g.completed_at DESC NULLS LAST, g.updated_at DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_profile_recent(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_recent(text) TO authenticated;
