import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "./Text";
import { alpha, colors, neonGradient, radius, shadowGlow } from "@/theme";

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "neon" | "done" | "want" | "glass";
type Size = "default" | "sm" | "lg" | "icon";

interface Props {
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<Size, number> = { default: 40, sm: 34, lg: 48, icon: 40 };

function palette(variant: ButtonVariant): { bg?: string; border?: string; fg: string } {
  switch (variant) {
    case "destructive":
      return { bg: colors.destructive, fg: "#fff" };
    case "outline":
      return { bg: colors.background, border: colors.border, fg: colors.foreground };
    case "secondary":
      return { bg: colors.secondary, fg: colors.foreground };
    case "ghost":
      return { fg: colors.foreground };
    case "neon":
      return { fg: colors.primaryForeground };
    case "done":
      return { bg: alpha(colors.statusDone, 0.15), border: alpha(colors.statusDone, 0.4), fg: colors.statusDone };
    case "want":
      return { bg: alpha(colors.statusWant, 0.15), border: alpha(colors.statusWant, 0.4), fg: colors.statusWant };
    case "glass":
      return { bg: alpha(colors.background, 0.6), border: colors.border, fg: colors.foreground };
    default:
      return { bg: colors.primary, fg: colors.primaryForeground };
  }
}

export function Button({
  children,
  onPress,
  variant = "default",
  size = "default",
  icon,
  disabled,
  loading,
  fullWidth,
  accessibilityLabel,
  style,
}: Props) {
  const p = palette(variant);
  const isIcon = size === "icon";
  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon}
      {children != null && typeof children === "string" ? (
        <Text
          weight={variant === "neon" ? "semibold" : "medium"}
          style={{ color: p.fg, fontSize: size === "sm" ? 12 : 14 }}
          numberOfLines={1}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );

  const base: ViewStyle = {
    height: HEIGHT[size],
    minWidth: isIcon ? HEIGHT.icon : undefined,
    width: isIcon ? HEIGHT.icon : fullWidth ? "100%" : undefined,
    paddingHorizontal: isIcon ? 0 : size === "sm" ? 12 : size === "lg" ? 28 : 16,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: p.bg,
    borderWidth: p.border ? 1 : 0,
    borderColor: p.border,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        base,
        variant === "neon" && shadowGlow,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {variant === "neon" && (
        <LinearGradient
          colors={neonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.4 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
