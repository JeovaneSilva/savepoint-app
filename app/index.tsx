import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, Library, Search } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { H2, Text } from "@/components/ui/Text";
import { Logo, RawgAttribution } from "@/components/Brand";
import { useAuth } from "@/hooks/use-auth";
import { alpha, colors, radius, shadowCard } from "@/theme";

const FEATURES = [
  { Icon: Search, title: "Busque qualquer jogo", text: "Milhares de títulos de todas as gerações, do Atari 2600 ao PS5." },
  { Icon: Library, title: "Sua biblioteca", text: "Zerados, jogando, na fila ou abandonados — com nota e anotações." },
  { Icon: BarChart3, title: "Suas estatísticas", text: "Veja quantos jogos zerou por ano, plataformas e gêneros favoritos." },
];

export default function Landing() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  if (user) return <Redirect href="/biblioteca" />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingTop: insets.top }}>
        <Image
          source={require("../assets/hero-controllers.jpg")}
          contentFit="cover"
          contentPosition="right"
          style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}
        />
        <LinearGradient
          colors={[colors.background, alpha(colors.background, 0.85), "transparent"]}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", colors.background]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
        />

        <View style={styles.header}>
          <Logo size={26} />
          <Button variant="glass" size="sm" onPress={() => router.push("/auth")}>
            Entrar
          </Button>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 96 }}>
          <Text
            display
            weight="semibold"
            style={{ color: colors.accent, fontSize: 13, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}
          >
            Press start
          </Text>
          <Text display weight="bold" style={{ fontSize: 44, lineHeight: 48, letterSpacing: -0.5 }}>
            Todo jogo que você <Text display weight="bold" style={{ fontSize: 44, lineHeight: 48, color: colors.primaryGlow }}>zerou</Text>. E os que ainda vai.
          </Text>
          <Text muted style={{ fontSize: 17, lineHeight: 26, marginTop: 24, maxWidth: 360 }}>
            O SavePoint guarda sua história gamer — PC e console, de qualquer geração.
          </Text>
          <View style={{ marginTop: 36, flexDirection: "row" }}>
            <Button variant="neon" size="lg" onPress={() => router.push("/auth")}>
              Começar agora
            </Button>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {FEATURES.map(({ Icon, title, text }) => (
          <View key={title} style={styles.feature}>
            <Icon size={24} color={colors.accent} style={{ marginBottom: 16 }} />
            <H2 style={{ fontSize: 18, marginBottom: 4 }}>{title}</H2>
            <Text muted>{text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <RawgAttribution />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 20 },
  feature: {
    backgroundColor: alpha(colors.card, 0.7),
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius["2xl"],
    padding: 24,
    ...shadowCard,
  },
  footer: { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
});
