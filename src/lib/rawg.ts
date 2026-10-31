import { supabase } from "./supabase";
import { buildSearchParams, isTrendingMode, type GameDetails, type GameSummary, type SearchFilters } from "./games";

export type SearchResponse = {
  results: GameSummary[];
  hasMore: boolean;
  count: number;
  error?: "missing_key" | "quota" | "unavailable";
};

export type DetailsResponse = {
  game: GameDetails | null;
  error?: "missing_key" | "not_found" | "quota" | "unavailable";
};

/** Search games through the `rawg` Edge Function (the RAWG key stays server-side). */
export async function searchGames(filters: SearchFilters): Promise<SearchResponse> {
  const { data, error } = await supabase.functions.invoke<SearchResponse>("rawg", {
    body: { action: "search", params: buildSearchParams(filters), trending: isTrendingMode(filters) },
  });
  if (error || !data) return { results: [], hasMore: false, count: 0, error: "unavailable" };
  return data;
}

export async function getGameDetails(id: number): Promise<DetailsResponse> {
  const { data, error } = await supabase.functions.invoke<DetailsResponse>("rawg", {
    body: { action: "details", id },
  });
  if (error || !data) return { game: null, error: "unavailable" };
  return data;
}

/** Cover + basic info only (1 RAWG request, shared cache). Used by the importer. */
export async function getGameCover(id: number): Promise<GameSummary | null> {
  const { data, error } = await supabase.functions.invoke<{ game: GameSummary | null }>("rawg", {
    body: { action: "cover", id },
  });
  return error || !data ? null : data.game;
}
