-- Per-user hourly counter for requests that actually reach RAWG (cache misses), used by the `rawg` Edge Function
-- so a single account can't burn the shared monthly quota. Only the service role / this function touch it.

CREATE TABLE IF NOT EXISTS public.rawg_user_usage (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  hour timestamptz NOT NULL,          -- start of the hour
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hour)
);

ALTER TABLE public.rawg_user_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rawg_user_usage FROM anon, authenticated;
GRANT ALL ON public.rawg_user_usage TO service_role;

-- Adds one request for this user in the current hour; returns true while they are still within p_limit.
CREATE OR REPLACE FUNCTION public.rawg_bump_user(p_user uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
BEGIN
  INSERT INTO public.rawg_user_usage (user_id, hour, requests)
  VALUES (p_user, date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, hour) DO UPDATE SET requests = public.rawg_user_usage.requests + 1
  RETURNING requests INTO total;
  RETURN total <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rawg_bump_user(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rawg_bump_user(uuid, integer) TO service_role;
