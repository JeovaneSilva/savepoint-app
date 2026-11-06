-- Clean-up after the move from RAWG to IGDB.
--
-- Run AFTER deleting the old `rawg` Edge Function (it was the only user of the monthly counter removed here).
-- Safe to run more than once.
--
-- What is NOT removed on purpose: `rawg_cache`, `rawg_user_usage` and `rawg_bump_user`. Their names are historical,
-- but the `igdb` function still uses them (response cache, per-user hourly counter). Renaming would force a new
-- deploy of the function for no functional gain.

-- 1) Monthly RAWG request counter: IGDB has no monthly quota, nothing reads it any more.
DROP FUNCTION IF EXISTS public.rawg_bump_usage(text, integer);
DROP TABLE IF EXISTS public.rawg_usage;

-- 2) Cached RAWG answers (keys "game:", "search:", "shots:"). IGDB entries all start with "igdb:" and stay.
DELETE FROM public.rawg_cache WHERE key NOT LIKE 'igdb:%';
