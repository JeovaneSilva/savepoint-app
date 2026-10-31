import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export interface MyBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  threshold: number;
  progress: number;
  earned_at: string | null;
}

/** All badges with my progress. Refetched after every library change (badges are awarded by DB triggers). */
export function useMyBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["badges", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<MyBadge[]> => {
      const { data, error } = await supabase.rpc("get_my_badges");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Mount once while signed in: shows a toast whenever a new badge shows up. */
export function useBadgeWatcher() {
  const { data } = useMyBadges();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const earned = data.filter((b) => b.earned_at);
    if (seen.current === null) {
      // First load: remember what I already have, don't announce old badges.
      seen.current = new Set(earned.map((b) => b.id));
      return;
    }
    const fresh = earned.filter((b) => !seen.current?.has(b.id));
    if (fresh.length === 0) return;
    for (const b of fresh) seen.current.add(b.id);
    toast.success(`Selo desbloqueado: ${fresh.map((b) => b.name).join(", ")}`);
  }, [data]);
}

export interface PublicProfile {
  nickname: string;
  avatar_path: string | null;
  avatar_updated_at: string | null;
  member_since: string;
  completed_total: number;
  hours_total: number;
  library_total: number;
  badges_total: number;
  is_me: boolean;
}

export interface PublicBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  earned_at: string;
}

export interface RecentGame {
  rawg_id: number;
  name: string;
  cover_url: string | null;
  completed_at: string | null;
}

const key = (nickname: string) => nickname.trim().toLowerCase();

export function usePublicProfile(nickname: string) {
  return useQuery({
    queryKey: ["public-profile", key(nickname)],
    enabled: nickname.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicProfile | null> => {
      const { data, error } = await supabase.rpc("get_profile", { p_nickname: nickname });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function usePublicBadges(nickname: string, enabled: boolean) {
  return useQuery({
    queryKey: ["public-profile", key(nickname), "badges"],
    enabled: enabled && nickname.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicBadge[]> => {
      const { data, error } = await supabase.rpc("get_profile_badges", { p_nickname: nickname });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecentCompleted(nickname: string, enabled: boolean) {
  return useQuery({
    queryKey: ["public-profile", key(nickname), "recent"],
    enabled: enabled && nickname.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<RecentGame[]> => {
      const { data, error } = await supabase.rpc("get_profile_recent", { p_nickname: nickname });
      if (error) throw error;
      return data ?? [];
    },
  });
}
