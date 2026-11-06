import { useEffect } from "react";
import { Stack, SplashScreen, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from "@expo-google-fonts/rubik";
import { ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold } from "@expo-google-fonts/chakra-petch";
import { useAccountStatus } from "@/hooks/use-account";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ErrorScreen } from "@/components/ErrorScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { CACHE_MAX_AGE, persister, queryClient, shouldPersist } from "@/lib/query";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

/** expo-router renders this instead of the app when something throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} onRetry={() => void retry()} />;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const account = useAccountStatus();
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    ChakraPetch_500Medium,
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
  });
  // With a session, also wait to know whether the account is approved (cached after the first time).
  const ready = fontsLoaded && !loading && (!user || !account.isPending);
  const approved = !!user && account.data?.status === "approved";

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* Signed-in AND approved */}
      <Stack.Protected guard={approved}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jogo/[id]" />
        <Stack.Screen name="apelido" />
        <Stack.Screen name="meu-perfil" />
        <Stack.Screen name="perfil/[nickname]" />
        <Stack.Screen name="aprovacoes" />
      </Stack.Protected>
      {/* Signed in but waiting for approval (or blocked) */}
      <Stack.Protected guard={!!user && !approved}>
        <Stack.Screen name="aguardando" />
      </Stack.Protected>
      {/* Public screens: always registered, they redirect once there is a session. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: CACHE_MAX_AGE,
          buster: "v5",
          dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
        }}
      >
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
