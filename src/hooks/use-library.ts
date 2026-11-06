import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import type { UserGame, UserGameInsert, UserGameUpdate } from "@/lib/games";

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
