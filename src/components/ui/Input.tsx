import { forwardRef, useState, type ComponentRef, type ReactNode } from "react";
import { Platform, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { alpha, colors, fonts, radius, shadowGlow } from "@/theme";

interface Props extends TextInputProps {
  left?: ReactNode;
  right?: ReactNode;
  height?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, Props>(function Input(
  { left, right, height = 40, multiline, containerStyle, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          minHeight: height,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: focused ? colors.primary : colors.border,
          paddingHorizontal: 12,
          gap: 8,
          backgroundColor: alpha(colors.card, 0.4),
        },
        // Glow only on iOS: toggling `elevation` on Android re-creates the native view and drops focus/keyboard.
        focused && Platform.OS === "ios" && { ...shadowGlow, elevation: undefined },
        containerStyle,
      ]}
    >
      {left}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            flex: 1,
            color: colors.foreground,
            fontFamily: fonts.regular,
            fontSize: 15,
            paddingVertical: multiline ? 10 : 0,
            minHeight: multiline ? height : undefined,
            textAlignVertical: multiline ? "top" : "center",
          } as object,
          style,
        ]}
        {...props}
      />
      {right}
    </View>
  );
});

export function Label({ children }: { children: string }) {
  return (
    <Text weight="medium" style={{ fontSize: 14, marginBottom: 8 }}>
      {children}
    </Text>
  );
}
