-- Shared cache for RAWG responses + monthly request counter.
-- Only the `rawg` Edge Function (service role) touches these tables: RLS is on and there are no
-- policies, so signed-in app users cannot read or write them directly.

CREATE TABLE IF NOT EXISTS public.rawg_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rawg_cache_fetched_at_idx ON public.rawg_cache (fetched_at);

ALTER TABLE public.rawg_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rawg_cache FROM anon, authenticated;
GRANT ALL ON public.rawg_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.rawg_usage (
  month text PRIMARY KEY,            -- 'YYYY-MM'
  requests integer NOT NULL DEFAULT 0
);

ALTER TABLE public.rawg_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rawg_usage FROM anon, authenticated;
GRANT ALL ON public.rawg_usage TO service_role;

-- Atomically adds p_n requests to the month's counter and returns the new total.
CREATE OR REPLACE FUNCTION public.rawg_bump_usage(p_month text, p_n integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
BEGIN
  INSERT INTO public.rawg_usage (month, requests) VALUES (p_month, p_n)
  ON CONFLICT (month) DO UPDATE SET requests = public.rawg_usage.requests + p_n
  RETURNING requests INTO total;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.rawg_bump_usage(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rawg_bump_usage(text, integer) TO service_role;
