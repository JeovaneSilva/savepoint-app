import type { ComponentType, ReactNode } from "react";
import { Linking, Platform, StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import RNMaskedView from "@react-native-masked-view/masked-view";
import { Text } from "./ui/Text";
import { colors, neonGradient, radius } from "@/theme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MaskedView = RNMaskedView as unknown as ComponentType<any>;

/** Text filled with the neon gradient (web's `text-gradient-neon`). */
export function GradientText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  // The mask view has no web implementation: fall back to a solid brand color there.
  if (Platform.OS === "web") return <Text style={[style, { color: colors.primaryGlow }]}>{children}</Text>;
  return (
    <MaskedView maskElement={<Text style={[style, { backgroundColor: "transparent" }]}>{children}</Text>}>
      <LinearGradient colors={neonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  const style = { fontSize: size, lineHeight: size * 1.25, letterSpacing: -0.4 };
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text display weight="bold" style={style}>
        Save
      </Text>
      <GradientText style={{ ...style, fontFamily: "ChakraPetch_700Bold" }}>Point</GradientText>
    </View>
  );
}

export function RawgAttribution() {
  return (
    <Text muted style={{ fontSize: 12, textAlign: "center" }}>
      Dados de jogos fornecidos por{" "}
      <Text
        weight="semibold"
        onPress={() => Linking.openURL("https://rawg.io")}
        style={{ color: colors.accent, fontSize: 12 }}
      >
        RAWG
      </Text>
    </Text>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text display weight="semibold" style={{ fontSize: 20, marginTop: 16, textAlign: "center" }}>
        {title}
      </Text>
      <Text muted style={{ marginTop: 4, textAlign: "center", maxWidth: 320 }}>
        {text}
      </Text>
      {action && <View style={{ marginTop: 20 }}>{action}</View>}
    </View>
  );
}

/** Rounded bordered card surface used across screens. */
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}


const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: "rgba(16,16,29,0.4)",
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius["2xl"],
    padding: 16,
  },
});
