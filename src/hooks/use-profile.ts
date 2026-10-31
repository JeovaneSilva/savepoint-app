import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/use-auth";
import { AvatarError, describeAvatarError, pickAvatarFile, removeAvatarFile, uploadAvatar } from "@/lib/avatar";
import { isNicknameAvailable, validateNickname } from "@/lib/nickname";
import { supabase } from "@/lib/supabase";

export interface Profile {
  nickname: string;
  avatar_path: string | null;
  avatar_updated_at: string | null;
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
      const { data, error } = await supabase
        .from("profiles")
        .select("nickname, avatar_path, avatar_updated_at")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Everything that shows a nickname or photo must refresh after the profile changes. */
function useRefreshProfileViews() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["public-profile"] });
    qc.invalidateQueries({ queryKey: ["ranking"] });
  };
}

export function useSaveNickname() {
  const { user } = useAuth();
  const refresh = useRefreshProfileViews();
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
      refresh();
      toast.success("Apelido salvo");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o apelido"),
  });
}

/** Pick a photo from the gallery, shrink it and upload it as the profile photo. */
export function useChangeAvatar() {
  const { user } = useAuth();
  const refresh = useRefreshProfileViews();
  return useMutation({
    mutationFn: async (): Promise<boolean> => {
      if (!user) throw new Error("Você precisa estar logado");
      let file: string | null;
      try {
        file = await pickAvatarFile();
      } catch (e) {
        throw e instanceof AvatarError ? e : describeAvatarError("preparar", e);
      }
      if (!file) return false; // cancelled
      const path = await uploadAvatar(user.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_path: path, avatar_updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw describeAvatarError("salvar", error);
      return true;
    },
    onSuccess: (changed) => {
      if (!changed) return;
      refresh();
      toast.success("Foto atualizada");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível enviar a foto."),
  });
}

export function useRemoveAvatar() {
  const { user } = useAuth();
  const refresh = useRefreshProfileViews();
  return useMutation({
    mutationFn: async (path: string) => {
      if (!user) throw new Error("Você precisa estar logado");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_path: null, avatar_updated_at: null })
        .eq("user_id", user.id);
      if (error) throw error;
      await removeAvatarFile(path).catch(() => undefined); // the profile no longer points to it anyway
    },
    onSuccess: () => {
      refresh();
      toast.success("Foto removida");
    },
    onError: () => toast.error("Não foi possível remover a foto"),
  });
}
