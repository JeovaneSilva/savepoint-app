-- Manual approval of accounts.
--
-- Every new account starts as 'pending'. Until an admin approves it, the
-- database refuses to show it any app data: user_games RLS and every ranking/profile/badge function check
-- public.is_approved(), and the `rawg` Edge Function checks it too (so pending accounts can't spend the RAWG quota).
--
-- Statuses: 'pending' (default) | 'approved' | 'blocked'.
-- Accounts that exist when this migration runs are approved automatically (you and any test accounts).
--
-- AFTER RUNNING: make yourself admin (once), replacing the email:
--   INSERT INTO public.app_admins (user_id) SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI' ON CONFLICT DO NOTHING;

/* ---------------- Tables ---------------- */

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.account_approvals (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- No policies on purpose: only the SECURITY DEFINER functions below (and the service role) touch these tables.
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins FROM anon, authenticated;
REVOKE ALL ON public.account_approvals FROM anon, authenticated;
GRANT ALL ON public.app_admins TO service_role;
GRANT ALL ON public.account_approvals TO service_role;

-- Everyone who already exists keeps working.
INSERT INTO public.account_approvals (user_id, status)
SELECT id, 'approved' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

/* ---------------- Helpers ---------------- */

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_approvals a WHERE a.user_id = auth.uid() AND a.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_approved() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- What the app asks right after login. A missing row means 'pending'.
CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS TABLE (status text, is_admin boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((SELECT a.status FROM public.account_approvals a WHERE a.user_id = auth.uid()), 'pending'),
    EXISTS (SELECT 1 FROM public.app_admins ad WHERE ad.user_id = auth.uid())
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_status() TO authenticated;

/* ---------------- New accounts start as pending ---------------- */

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nick text := nullif(btrim(NEW.raw_user_meta_data ->> 'nickname'), '');
BEGIN
  BEGIN
    INSERT INTO public.account_approvals (user_id, status) VALUES (NEW.id, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a missing row already counts as pending
  END;

  IF nick IS NOT NULL THEN
    BEGIN
      INSERT INTO public.profiles (user_id, nickname) VALUES (NEW.id, nick);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- invalid/taken nickname: the app asks for one later
    END;
  END IF;
  RETURN NEW;
END;
$$;

/* ---------------- Data is only for approved accounts ---------------- */

DROP POLICY IF EXISTS "Users view own games" ON public.user_games;
DROP POLICY IF EXISTS "Users insert own games" ON public.user_games;
DROP POLICY IF EXISTS "Users update own games" ON public.user_games;
DROP POLICY IF EXISTS "Users delete own games" ON public.user_games;

CREATE POLICY "Users view own games" ON public.user_games
  FOR SELECT TO authenticated USING (auth.uid() = user_id AND (SELECT public.is_approved()));
CREATE POLICY "Users insert own games" ON public.user_games
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (SELECT public.is_approved()));
CREATE POLICY "Users update own games" ON public.user_games
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (SELECT public.is_approved()))
  WITH CHECK (auth.uid() = user_id AND (SELECT public.is_approved()));
CREATE POLICY "Users delete own games" ON public.user_games
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND (SELECT public.is_approved()));

-- Ranking, profiles and badges: same functions as before, now gated by is_approved().
CREATE OR REPLACE FUNCTION public.get_ranking(p_year integer)
RETURNS TABLE (
  nickname text, avatar_path text, avatar_updated_at timestamptz,
  completed_total integer, completed_year integer, library_total integer, is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.nickname, p.avatar_path, p.avatar_updated_at,
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
  WHERE public.is_approved()
    AND EXISTS (SELECT 1 FROM public.account_approvals a WHERE a.user_id = p.user_id AND a.status = 'approved')
  GROUP BY p.user_id, p.nickname, p.avatar_path, p.avatar_updated_at;
$$;

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
  WHERE public.is_approved()
  ORDER BY b.sort;
$$;

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
  WHERE public.is_approved()
    AND lower(p.nickname) = lower(btrim(p_nickname))
    AND EXISTS (SELECT 1 FROM public.account_approvals a WHERE a.user_id = p.user_id AND a.status = 'approved');
$$;

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
  WHERE public.is_approved()
    AND lower(p.nickname) = lower(btrim(p_nickname))
    AND EXISTS (SELECT 1 FROM public.account_approvals a WHERE a.user_id = p.user_id AND a.status = 'approved')
  ORDER BY b.sort;
$$;

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
  WHERE public.is_approved()
    AND lower(p.nickname) = lower(btrim(p_nickname))
    AND g.status = 'concluido'
    AND EXISTS (SELECT 1 FROM public.account_approvals a WHERE a.user_id = p.user_id AND a.status = 'approved')
  ORDER BY g.completed_at DESC NULLS LAST, g.updated_at DESC
  LIMIT 5;
$$;

/* ---------------- Admin: list and decide ---------------- */

-- Pending first, then newest. Returns nothing for non-admins.
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (user_id uuid, email text, nickname text, created_at timestamptz, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::text, p.nickname, u.created_at, coalesce(a.status, 'pending')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.account_approvals a ON a.user_id = u.id
  WHERE public.is_admin()
  ORDER BY (coalesce(a.status, 'pending') = 'pending') DESC, u.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_status(p_user uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'blocked') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF p_user = auth.uid() AND p_status <> 'approved' THEN
    RAISE EXCEPTION 'you cannot change your own status';
  END IF;
  INSERT INTO public.account_approvals (user_id, status, decided_by, updated_at)
  VALUES (p_user, p_status, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = EXCLUDED.status, decided_by = auth.uid(), updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_ranking(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_badges() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profile(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profile_badges(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profile_recent(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_badges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_badges(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_recent(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_status(uuid, text) TO authenticated;
