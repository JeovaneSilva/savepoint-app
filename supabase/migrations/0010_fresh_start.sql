-- FRESH START on IGDB. Run once, after 0009 (it is also safe if 0009 was never run).
--
-- DESTRUCTIVE: deletes every user's game library and the badges earned from it. This cannot be undone.
-- Accounts, nicknames, photos and approvals are NOT touched: everyone keeps their login and starts with an empty library.
--
-- Afterwards games are identified only by their IGDB id, and the legacy RAWG id column is removed.
-- (Whoever wants their old list back can export it before running this and import it later: the importer
--  re-finds each game in IGDB by title.)

BEGIN;

/* ---------------- 1) Clear libraries and the badges they produced ---------------- */

DELETE FROM public.user_games;
DELETE FROM public.user_badges;

/* ---------------- 2) Games are identified by igdb_id only ---------------- */

ALTER TABLE public.user_games ADD COLUMN IF NOT EXISTS igdb_id integer;   -- already there if 0009 ran
ALTER TABLE public.user_games ALTER COLUMN igdb_id SET NOT NULL;           -- the table is empty now

ALTER TABLE public.user_games DROP CONSTRAINT IF EXISTS user_games_has_game_id;
DROP INDEX IF EXISTS public.user_games_user_igdb_unique;
DROP INDEX IF EXISTS public.user_games_igdb_id_idx;

ALTER TABLE public.user_games DROP CONSTRAINT IF EXISTS user_games_user_igdb_key;
ALTER TABLE public.user_games ADD CONSTRAINT user_games_user_igdb_key UNIQUE (user_id, igdb_id);

-- The profile function mentions rawg_id: drop it first, then the column (this also drops its unique constraint).
DROP FUNCTION IF EXISTS public.get_profile_recent(text);
ALTER TABLE public.user_games DROP COLUMN IF EXISTS rawg_id;

-- Last completed games on a profile: name + cover + date only (never rating or notes), approved accounts only.
CREATE FUNCTION public.get_profile_recent(p_nickname text)
RETURNS TABLE (igdb_id integer, name text, cover_url text, completed_at date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.igdb_id, g.name, g.cover_url, g.completed_at
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

COMMIT;
