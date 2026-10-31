import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import type { UserGame, UserGameInsert, UserGameUpdate } from "@/lib/games";

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: async (): Promise<UserGame[]> => {
    const { data, error } = await supabase.from("user_games").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export function useLibrary() {
  return useQuery(libraryQuery);
}

/** Map of rawg_id -> library entry, used for "already in your library" badges. */
export function useLibraryMap() {
  const { data } = useQuery(libraryQuery);
  const map = new Map<number, UserGame>();
  for (const g of data ?? []) map.set(g.rawg_id, g);
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
      qc.invalidateQueries({ queryKey: ["library"] });
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
      qc.invalidateQueries({ queryKey: ["library"] });
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
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success(`${g.name} removido da lista`);
    },
    onError: () => toast.error("Não foi possível remover o jogo"),
  });
}
