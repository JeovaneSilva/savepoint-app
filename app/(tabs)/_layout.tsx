import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { BarChart3, Library, LogOut, Search, Trophy } from "lucide-react-native";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { useSignOut } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { alpha, colors, fonts } from "@/theme";

export const unstable_settings = { initialRouteName: "biblioteca" };

export default function TabsLayout() {
  const signOut = useSignOut();
  const { data: profile, isPending } = useProfile();

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
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="Sair"
            icon={<LogOut size={20} color={colors.foreground} />}
            onPress={signOut}
            style={{ marginRight: 8 }}
          />
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
