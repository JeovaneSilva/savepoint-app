import { useEffect, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { fetchCovers } from "@/lib/igdb";
import { supabase } from "@/lib/supabase";
import { needsCoverRefresh, type UserGame, type UserGameInsert, type UserGameUpdate } from "@/lib/games";

/** Library changes can unlock badges and move the ranking / public profile numbers. */
export function invalidateDerived(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["library"] });
  qc.invalidateQueries({ queryKey: ["badges"] });
  qc.invalidateQueries({ queryKey: ["ranking"] });
  qc.invalidateQueries({ queryKey: ["public-profile"] });
}

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: async (): Promise<UserGame[]> => {
    // The API returns at most ~1000 rows per request: read the library in pages so nothing is cut off silently.
    const PAGE = 500;
    const all: UserGame[] = [];
    let total = Infinity;
    while (all.length < total) {
      const { data, error, count } = await supabase
        .from("user_games")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }) // stable order across pages
        .range(all.length, all.length + PAGE - 1);
      if (error) throw error;
      const rows = data ?? [];
      total = count ?? rows.length;
      if (rows.length === 0) break; // nothing more (guards against an endless loop)
      all.push(...rows);
    }
    return all;
  },
});

export function useLibrary() {
  return useQuery(libraryQuery);
}

/** Map of igdb_id -> library entry, used for "already in your library" badges. */
export function useLibraryMap() {
  const { data } = useQuery(libraryQuery);
  const map = new Map<number, UserGame>();
  for (const g of data ?? []) map.set(g.igdb_id, g);
  return map;
}

export function useAddGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (game: Omit<UserGameInsert, "user_id">) => {
      const { data, error } = await supabase.from("user_games").insert(game).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (g) => {
      invalidateDerived(qc);
      toast.success(`${g.name} adicionado à sua biblioteca`);
    },
    onError: (e: { code?: string }) => {
      toast.error(e?.code === "23505" ? "Esse jogo já está na sua lista" : "Não foi possível adicionar o jogo");
    },
  });
}

export function useUpdateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UserGameUpdate }) => {
      const { data, error } = await supabase.from("user_games").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (g) => {
      invalidateDerived(qc);
      toast.success(`${g.name} atualizado`);
    },
    onError: () => toast.error("Não foi possível salvar as alterações"),
  });
}

export function useRemoveGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (game: Pick<UserGame, "id" | "name">) => {
      const { error } = await supabase.from("user_games").delete().eq("id", game.id);
      if (error) throw error;
      return game;
    },
    onSuccess: (g) => {
      invalidateDerived(qc);
      toast.success(`${g.name} removido da lista`);
    },
    onError: () => toast.error("Não foi possível remover o jogo"),
  });
}

/**
 * Covers saved before the current image rules (or with no cover) are looked up again, once per app session and in one
 * request, so a library fixes itself after the rules improve. Failures are ignored: the old cover just stays.
 */
export function useRefreshStaleCovers(games: UserGame[] | undefined) {
  const qc = useQueryClient();
  const tried = useRef(new Set<number>());

  useEffect(() => {
    if (!games?.length) return;
    const batch = games.filter((g) => needsCoverRefresh(g.cover_url) && !tried.current.has(g.igdb_id)).slice(0, 50);
    if (batch.length === 0) return;
    for (const g of batch) tried.current.add(g.igdb_id);

    let cancelled = false;
    (async () => {
      const images = await fetchCovers(batch.map((g) => g.igdb_id));
      let changed = false;
      for (const img of images) {
        if (!img.cover) continue;
        for (const g of batch.filter((x) => x.igdb_id === img.id)) {
          const { error } = await supabase.from("user_games").update({ cover_url: img.cover }).eq("id", g.id);
          if (!error) changed = true;
        }
      }
      if (changed && !cancelled) qc.invalidateQueries({ queryKey: ["library"] });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [games, qc]);
}
