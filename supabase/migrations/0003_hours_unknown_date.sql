-- Optional hours to finish a game + "I don't remember when I finished it".

ALTER TABLE public.user_games
  ADD COLUMN IF NOT EXISTS hours_played numeric(6, 1),
  ADD COLUMN IF NOT EXISTS completed_date_unknown boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_games
  ADD CONSTRAINT user_games_hours_played_range
    CHECK (hours_played IS NULL OR (hours_played >= 0 AND hours_played <= 99999)),
  -- An "unknown date" game must not also carry a date.
  ADD CONSTRAINT user_games_unknown_date_has_no_date
    CHECK (NOT completed_date_unknown OR completed_at IS NULL);

-- Games already marked as completed without a date are, in practice, "date unknown".
UPDATE public.user_games
SET completed_date_unknown = true
WHERE status = 'concluido' AND completed_at IS NULL;
