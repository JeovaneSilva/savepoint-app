import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export type AccountState = "pending" | "approved" | "blocked";

export interface AccountStatus {
  status: AccountState;
  is_admin: boolean;
}

/**
 * Is my account approved? Re-checks every 15s while it isn't, so the app opens by itself after the admin approves.
 * (The database enforces this anyway; this is what lets the UI show the right screen.)
 */
export function useAccountStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account-status", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.status === "approved" ? false : 15_000),
    queryFn: async (): Promise<AccountStatus> => {
      const { data, error } = await supabase.rpc("get_my_status");
      if (error) {
        // Migration 0007 not applied yet: don't lock everyone out of the app.
        if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
          console.warn("[account] get_my_status missing: run migration 0007");
          return { status: "approved", is_admin: false };
        }
        throw error;
      }
      const row = data?.[0];
      const status = (row?.status ?? "pending") as AccountState;
      return { status, is_admin: !!row?.is_admin };
    },
  });
}

export interface AccountRow {
  user_id: string;
  email: string;
  nickname: string | null;
  created_at: string;
  status: AccountState;
}

const accountsKey = ["admin-accounts"] as const;

/** Admin only (the function returns nothing for anyone else). */
export function useAdminAccounts(enabled: boolean) {
  return useQuery({
    queryKey: accountsKey,
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return (data ?? []) as AccountRow[];
    },
  });
}

/** Number of accounts waiting for approval, for the admin's badge/dot. */
export function usePendingCount(isAdmin: boolean): number {
  const { data } = useQuery({
    queryKey: accountsKey,
    enabled: isAdmin,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AccountRow[]> => {
      const { data: rows, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return (rows ?? []) as AccountRow[];
    },
    select: (rows) => rows.filter((r) => r.status === "pending"),
  });
  return data?.length ?? 0;
}

export function useSetAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: AccountState }) => {
      const { error } = await supabase.rpc("admin_set_status", { p_user: userId, p_status: status });
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      qc.invalidateQueries({ queryKey: accountsKey });
      qc.invalidateQueries({ queryKey: ["ranking"] });
      toast.success(status === "approved" ? "Conta aprovada" : status === "blocked" ? "Conta bloqueada" : "Conta voltou para pendente");
    },
    onError: (e: Error) => toast.error(`Não foi possível alterar a conta: ${e.message}`),
  });
}
