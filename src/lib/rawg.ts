import { supabase } from "./supabase";
import { buildSearchParams, isTrendingMode, type GameDetails, type GameSummary, type SearchFilters } from "./games";

export type SearchResponse = {
  results: GameSummary[];
  hasMore: boolean;
  count: number;
  error?: "missing_key" | "unavailable";
};

export type DetailsResponse = { game: GameDetails | null; error?: "missing_key" | "not_found" | "unavailable" };

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
