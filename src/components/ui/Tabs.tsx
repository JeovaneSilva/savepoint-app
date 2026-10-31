import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "./Text";
import { alpha, colors, radius, shadowGlow } from "@/theme";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Segmented tabs: muted track, active tab filled with the primary color + glow (as on the web). */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  scroll,
}: {
  value: T;
  onChange: (v: T) => void;
  items: TabItem<T>[];
  /** Horizontally scrollable track (many tabs); otherwise tabs share the width equally. */
  scroll?: boolean;
}) {
  const track = (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.muted,
        borderRadius: radius.lg,
        padding: 4,
        alignSelf: scroll ? "flex-start" : "stretch",
      }}
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.value)}
            style={[
              {
                flex: scroll ? undefined : 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: radius.sm,
              },
              active && { backgroundColor: colors.primary, ...shadowGlow, shadowRadius: 8 },
            ]}
          >
            <Text
              weight="medium"
              style={{ color: active ? colors.primaryForeground : colors.mutedForeground }}
            >
              {t.label}
            </Text>
            {t.count != null && (
              <Text
                style={{ fontSize: 14, color: active ? alpha(colors.primaryForeground, 0.7) : alpha(colors.mutedForeground, 0.7) }}
              >
                {String(t.count)}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
  if (!scroll) return track;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
      {track}
    </ScrollView>
  );
}

/** Single-select rounded chips (platform filter). */
export function Chips<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
}): ReactNode {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
      {items.map((c) => {
        const active = c.value === value;
        return (
          <Pressable
            key={c.value}
            onPress={() => onChange(c.value)}
            style={{
              height: 32,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: active ? alpha(colors.primary, 0.2) : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text weight="medium" style={{ fontSize: 13, color: active ? colors.foreground : colors.mutedForeground }}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
