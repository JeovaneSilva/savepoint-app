import { supabase } from "./supabase";
import type { GameDetails, GameSummary, PlatformGroup } from "./games";

export type ApiError = "missing_key" | "rate_limited" | "unavailable";

export type SearchResponse = {
  results: GameSummary[];
  hasMore: boolean;
  count: number;
  error?: ApiError;
};

export type DetailsResponse = {
  game: GameDetails | null;
  error?: ApiError | "not_found";
};

export interface SearchParams {
  search: string;
  platform?: PlatformGroup | null | undefined;
  /** One specific platform (wins over the group). */
  platformId?: number | null | undefined;
  genre?: number | null | undefined;
  /** Unreleased games, soonest first. */
  upcoming?: boolean | undefined;
  decade?: number | null | undefined;
  page: number;
}

/** Search games through the `igdb` Edge Function (the Twitch/IGDB credentials stay server-side). */
export async function searchGames(p: SearchParams): Promise<SearchResponse> {
  const { data, error } = await supabase.functions.invoke<SearchResponse>("igdb", {
    body: {
      action: "search",
      search: p.search,
      platform: p.platform ?? null,
      platformId: p.platformId ?? null,
      genre: p.genre ?? null,
      upcoming: p.upcoming ?? false,
      decade: p.decade ?? null,
      page: p.page,
    },
  });
  if (error || !data) return { results: [], hasMore: false, count: 0, error: "unavailable" };
  return data;
}

export async function getGameDetails(id: number): Promise<DetailsResponse> {
  const { data, error } = await supabase.functions.invoke<DetailsResponse>("igdb", {
    body: { action: "details", id },
  });
  if (error || !data) return { game: null, error: "unavailable" };
  return data;
}

/* ---------- finding the IGDB game for a title (importer) ---------- */

export interface MatchItem {
  name: string;
  year?: number | null | undefined;
  platforms?: string[] | undefined;
}

export interface MatchResult {
  index: number;
  status: "matched" | "doubt" | "none";
  best: { id: number; name: string; year: number | null; platforms: string[]; cover: string | null; genres: string[] } | null;
  candidates: { id: number; name: string; year: number | null }[];
}

/** Matches up to 20 titles per call. Items that couldn't be matched come back with status "doubt" or "none". */
export async function matchGames(items: MatchItem[]): Promise<{ results: MatchResult[]; error?: ApiError }> {
  const { data, error } = await supabase.functions.invoke<{ results: MatchResult[]; error?: ApiError }>("igdb", {
    body: { action: "match", items },
  });
  if (error || !data) return { results: [], error: "unavailable" };
  return data;
}

/** Best image for up to 50 saved games (one IGDB request). Used to refresh covers chosen by older rules. */
export async function fetchCovers(ids: number[]): Promise<{ id: number; cover: string | null }[]> {
  const { data, error } = await supabase.functions.invoke<{ images?: { id: number; cover: string | null }[] }>("igdb", {
    body: { action: "images", ids },
  });
  if (error || !data?.images) return [];
  return data.images;
}
