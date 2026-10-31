import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { persister } from "@/lib/query";
import { supabase } from "@/lib/supabase";

type AuthState = { user: User | null; loading: boolean };

const AuthContext = createContext<AuthState>({ user: null, loading: true });

/** App-wide auth listener: keeps the user fresh and resets cached data when the identity changes. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ user: session?.user ?? null, loading: false });
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        // The on-device copy belongs to the previous user: never show it to the next one.
        void persister.removeClient();
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Only the library depends on who is signed in; game details are the same for everyone.
        queryClient.invalidateQueries({ queryKey: ["library"] });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setState({ user: data.session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await queryClient.cancelQueries();
    await supabase.auth.signOut();
    queryClient.clear();
    await persister.removeClient();
  }, [queryClient]);
}
