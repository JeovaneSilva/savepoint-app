import { ScrollView, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { alpha, colors, radius } from "@/theme";

/**
 * Last-resort screen for an unexpected crash while rendering. It is shown in place of the whole app, so it must
 * not depend on any provider (auth, query, toast, safe-area): plain views and the theme only.
 */
export function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  console.error("[app] unexpected error", error);
  const detail = String(error?.message ?? error).slice(0, 300);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 400, alignSelf: "center", gap: 16 }}>
          <Text display weight="bold" style={{ fontSize: 28, textAlign: "center" }}>
            Game over… algo deu errado
          </Text>
          <Text muted style={{ textAlign: "center", lineHeight: 20 }}>
            O SavePoint encontrou um erro inesperado. Seus jogos estão salvos. Tente de novo; se o erro continuar, feche e abra o app.
          </Text>
          <View
            style={{
              padding: 12,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: alpha(colors.card, 0.8),
            }}
          >
            <Text muted style={{ fontSize: 12 }}>
              Detalhe (mande para o administrador se pedir):
            </Text>
            <Text style={{ fontSize: 12, marginTop: 4 }} selectable>
              {detail}
            </Text>
          </View>
          <Button variant="neon" fullWidth onPress={onRetry}>
            Tentar de novo
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
