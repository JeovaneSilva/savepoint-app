import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { alpha, colors } from "@/theme";

export type BadgeVariant =
  | "secondary"
  | "concluido"
  | "jogando"
  | "quero_jogar"
  | "abandonado"
  | "platform"
  | "neon";

function tone(c: string) {
  return { bg: alpha(c, 0.15), border: alpha(c, 0.4), fg: c };
}

const VARIANTS: Record<BadgeVariant, { bg: string; border: string; fg: string }> = {
  secondary: { bg: colors.secondary, border: "transparent", fg: colors.foreground },
  concluido: tone(colors.statusDone),
  jogando: tone(colors.statusPlaying),
  quero_jogar: tone(colors.statusWant),
  abandonado: tone(colors.statusDropped),
  platform: { bg: alpha(colors.background, 0.7), border: colors.border, fg: colors.mutedForeground },
  neon: { bg: alpha(colors.accent, 0.1), border: alpha(colors.accent, 0.4), fg: colors.accent },
};

export function Badge({
  variant = "secondary",
  icon,
  children,
  overlay,
  style,
}: {
  variant?: BadgeVariant;
  icon?: ReactNode;
  children: string;
  /** Solid backing so the badge stays readable on top of game art. */
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const isPlatform = variant === "platform";
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 4,
          borderWidth: 1,
          borderColor: v.border,
          backgroundColor: overlay ? alpha(colors.background, 0.85) : v.bg,
          borderRadius: isPlatform ? 4 : 8,
          paddingHorizontal: isPlatform ? 6 : 10,
          paddingVertical: isPlatform ? 1 : 2,
        },
        style,
      ]}
    >
      {icon}
      <Text
        weight={isPlatform ? "bold" : "semibold"}
        numberOfLines={1}
        style={{ color: v.fg, fontSize: isPlatform ? 10 : 12, letterSpacing: isPlatform ? 0.8 : 0 }}
      >
        {children}
      </Text>
    </View>
  );
}
