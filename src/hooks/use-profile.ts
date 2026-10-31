import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/use-auth";
import { isNicknameAvailable, validateNickname } from "@/lib/nickname";
import { supabase } from "@/lib/supabase";

export interface Profile {
  nickname: string;
}

/**
 * The signed-in user's profile. `data === null` means "loaded, but no nickname yet"
 * (accounts created before the ranking existed), which triggers the nickname screen.
 */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Profile | null> => {
      // RLS only lets each user see their own row.
      const { data, error } = await supabase.from("profiles").select("nickname").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveNickname() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nickname: string) => {
      const invalid = validateNickname(nickname);
      if (invalid) throw new Error(invalid);
      if (!user) throw new Error("Você precisa estar logado");
      if (!(await isNicknameAvailable(nickname))) throw new Error("Esse apelido já está em uso");
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, nickname: nickname.trim() }, { onConflict: "user_id" });
      if (error) {
        if (error.code === "23505") throw new Error("Esse apelido já está em uso");
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
      toast.success("Apelido salvo");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o apelido"),
  });
}
