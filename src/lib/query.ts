import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, type Query } from "@tanstack/react-query";

export const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime must be >= the persister's maxAge, otherwise restored data is dropped right away.
    queries: { retry: 1, staleTime: 30_000, gcTime: CACHE_MAX_AGE },
  },
});

/** On-device copy of the query cache: makes the library and visited games open instantly and offline. */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "gamelog-query-cache",
  throttleTime: 1000,
});

/** Only keep what is worth having on the device: the library and successfully loaded game details. */
export function shouldPersist(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const root = query.queryKey[0];
  if (root === "library") return true;
  if (root === "rawg-game") return (query.state.data as { game?: unknown } | undefined)?.game != null;
  return false;
}
