import { ActivityIndicator, Pressable, View } from "react-native";
import { Redirect, Tabs, router } from "expo-router";
import { BarChart3, Library, LogOut, Search, Trophy } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { useAccountStatus, usePendingCount } from "@/hooks/use-account";
import { useBadgeWatcher } from "@/hooks/use-badges";
import { useSignOut } from "@/hooks/use-auth";
import { useLibrary, useRefreshStaleCovers } from "@/hooks/use-library";
import { useProfile } from "@/hooks/use-profile";
import { alpha, colors, fonts } from "@/theme";

export const unstable_settings = { initialRouteName: "biblioteca" };

export default function TabsLayout() {
  const signOut = useSignOut();
  const { data: profile, isPending } = useProfile();
  useBadgeWatcher();
  useRefreshStaleCovers(useLibrary().data);
  const account = useAccountStatus();
  const pendingAccounts = usePendingCount(!!account.data?.is_admin);

  if (isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // Accounts created before the ranking have no nickname yet: ask for one before anything else.
  if (profile === null) return <Redirect href="/apelido" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: alpha(colors.background, 0.95), borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: () => <Logo size={22} />,
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
            {profile && (
              <Pressable accessibilityLabel="Meu perfil" onPress={() => router.push("/meu-perfil")} hitSlop={8}>
                <Avatar nickname={profile.nickname} path={profile.avatar_path} version={profile.avatar_updated_at} size={32} ring />
                {pendingAccounts > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.destructive,
                      borderWidth: 2,
                      borderColor: colors.background,
                    }}
                  />
                )}
              </Pressable>
            )}
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel="Sair"
              icon={<LogOut size={20} color={colors.foreground} />}
              onPress={signOut}
            />
          </View>
        ),
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: alpha(colors.background, 0.97),
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen name="buscar" options={{ title: "Buscar", tabBarIcon: ({ color }) => <Search size={20} color={color} /> }} />
      <Tabs.Screen
        name="biblioteca"
        options={{ title: "Biblioteca", tabBarIcon: ({ color }) => <Library size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="estatisticas"
        options={{ title: "Estatísticas", tabBarIcon: ({ color }) => <BarChart3 size={20} color={color} /> }}
      />
      <Tabs.Screen name="ranking" options={{ title: "Ranking", tabBarIcon: ({ color }) => <Trophy size={20} color={color} /> }} />
    </Tabs>
  );
}
