import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { Text } from "./Text";
import { colors, radius, shadowCard } from "@/theme";

type ToastKind = "success" | "error";
type ToastApi = { success: (m: string) => void; error: (m: string) => void };

// Module-level handle so mutation callbacks (non-React code) can raise toasts.
let external: ToastApi = { success: () => {}, error: () => {} };
export const toast: ToastApi = {
  success: (m) => external.success(m),
  error: (m) => external.error(m),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<{ kind: ToastKind; message: string } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setItem({ kind, message });
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setItem(null));
      }, 2800);
    },
    [opacity],
  );

  useEffect(() => {
    external = { success: (m) => show("success", m), error: (m) => show("error", m) };
  }, [show]);

  return (
    <>
      {children}
      {item && (
        <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 12, opacity }]}>
          <View style={styles.toast}>
            {item.kind === "success" ? (
              <CheckCircle2 size={18} color={colors.statusDone} />
            ) : (
              <XCircle size={18} color={colors.destructive} />
            )}
            <Text style={{ flex: 1 }} weight="medium">
              {item.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 999, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 480,
    width: "100%",
    backgroundColor: colors.popover,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadowCard,
  },
});
