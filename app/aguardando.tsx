import { ScrollView, View } from "react-native";
import { Hourglass, ShieldX, WifiOff } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { Card, Logo } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { H2, Text } from "@/components/ui/Text";
import { useAccountStatus } from "@/hooks/use-account";
import { useAuth, useSignOut } from "@/hooks/use-auth";
import { colors, shadowCard } from "@/theme";

/** Shown to signed-in accounts that are not approved yet (or were blocked). Re-checks by itself every 15s. */
export default function WaitingScreen() {
  const { user } = useAuth();
  const account = useAccountStatus();
  const signOut = useSignOut();

  const blocked = account.data?.status === "blocked";
  const failed = account.isError && !account.data;

  const icon = failed ? (
    <WifiOff size={40} color={colors.statusWant} />
  ) : blocked ? (
    <ShieldX size={40} color={colors.destructive} />
  ) : (
    <Hourglass size={40} color={colors.accent} />
  );
  const title = failed ? "Não foi possível verificar sua conta" : blocked ? "Acesso negado" : "Sua conta aguarda aprovação";
  const text = failed
    ? "Verifique a conexão e tente de novo."
    : blocked
      ? "O administrador não liberou o acesso desta conta ao SavePoint."
      : "O SavePoint está em fase inicial e cada conta é liberada manualmente. Assim que for aprovada, o app abre sozinho.";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 48 }}>
        <View style={{ width: "100%", maxWidth: 400, alignSelf: "center", gap: 28 }}>
          <View style={{ alignItems: "center" }}>
            <Logo size={36} />
          </View>
          <Card style={{ alignItems: "center", gap: 14, padding: 24, ...shadowCard }}>
            {icon}
            <H2 style={{ textAlign: "center" }}>{title}</H2>
            <Text muted style={{ textAlign: "center", lineHeight: 20 }}>
              {text}
            </Text>
            {user?.email && (
              <Text muted style={{ fontSize: 12, textAlign: "center" }}>
                {`Conta: ${user.email}`}
              </Text>
            )}
            {!blocked && (
              <Button variant="outline" loading={account.isFetching} onPress={() => void account.refetch()}>
                Verificar agora
              </Button>
            )}
            <Button variant="ghost" onPress={signOut}>
              Sair
            </Button>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
