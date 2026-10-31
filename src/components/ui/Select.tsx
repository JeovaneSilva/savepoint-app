import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown } from "lucide-react-native";
import { Text } from "./Text";
import { alpha, colors, radius } from "@/theme";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Title of the picker sheet. */
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/** Bottom-sheet picker, the mobile counterpart of the web's <Select>. */
export function Select({ value, onChange, options, placeholder = "Selecione", title, style }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={title ?? placeholder}
        onPress={() => setOpen(true)}
        style={[styles.trigger, style]}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: current ? colors.foreground : colors.mutedForeground }}>
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}
          >
            <View style={styles.grabber} />
            {title && (
              <Text display weight="semibold" style={{ fontSize: 18, marginBottom: 8, paddingHorizontal: 8 }}>
                {title}
              </Text>
            )}
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      (pressed || selected) && { backgroundColor: alpha(colors.primary, selected ? 0.18 : 0.1) },
                    ]}
                  >
                    <Text style={{ flex: 1 }} weight={selected ? "semibold" : "regular"}>
                      {item.label}
                    </Text>
                    {selected && <Check size={16} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
});
