import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, fonts } from "@/theme";

export interface TextProps extends RNTextProps {
  /** Rubik weight (body font). */
  weight?: "regular" | "medium" | "semibold" | "bold";
  /** Use the Chakra Petch display font (headings, numbers). */
  display?: boolean;
  muted?: boolean;
}

const BODY = { regular: fonts.regular, medium: fonts.medium, semibold: fonts.semibold, bold: fonts.bold };
const DISPLAY = {
  regular: fonts.displayMedium,
  medium: fonts.displayMedium,
  semibold: fonts.displaySemibold,
  bold: fonts.displayBold,
};

export function Text({ weight = "regular", display, muted, style, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: (display ? DISPLAY : BODY)[weight], color: muted ? colors.mutedForeground : colors.foreground, fontSize: 14 },
        style,
      ]}
    />
  );
}

/** Page title, matching the web's h1 (display font, bold). */
export function H1({ style, ...props }: TextProps) {
  return <Text display weight="bold" {...props} style={[{ fontSize: 28, lineHeight: 34, letterSpacing: -0.3 }, style]} />;
}

export function H2({ style, ...props }: TextProps) {
  return <Text display weight="semibold" {...props} style={[{ fontSize: 20, lineHeight: 26 }, style]} />;
}
