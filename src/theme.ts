/**
 * SavePoint design tokens — port of the web app's dark "gamer" theme.
 * Original values were oklch; converted to sRGB hex.
 */
export const colors = {
  background: "#070711",
  foreground: "#f1f1fa",
  card: "#10101d",
  popover: "#121221",
  primary: "#8e51ff",
  primaryForeground: "#fbfbff",
  primaryGlow: "#b675ff",
  secondary: "#1c1c2d",
  muted: "#191927",
  mutedForeground: "#9696ab",
  accent: "#21d3ee",
  accentForeground: "#020f19",
  destructive: "#f53b4b",
  border: "#29283f",
  statusDone: "#3cc96a",
  statusPlaying: "#2896f5",
  statusWant: "#f6c330",
  statusDropped: "#848592",
  star: "#f6c330",
  chart: ["#8e51ff", "#21d3ee", "#3cc96a", "#f6c330", "#f153aa"],
  sidebar: "#0b0b16",
  sidebarAccent: "#1c1a2f",
  sidebarBorder: "#222234",
} as const;

export const radius = { sm: 8, md: 10, lg: 12, xl: 16, "2xl": 20 } as const;

/** hex (#rrggbb) + alpha (0–1) -> rgba() string. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const fonts = {
  regular: "Rubik_400Regular",
  medium: "Rubik_500Medium",
  semibold: "Rubik_600SemiBold",
  bold: "Rubik_700Bold",
  displayMedium: "ChakraPetch_500Medium",
  displaySemibold: "ChakraPetch_600SemiBold",
  displayBold: "ChakraPetch_700Bold",
} as const;

export const neonGradient = [colors.primary, colors.primaryGlow, colors.accent] as const;

export const shadowCard = {
  shadowColor: "#000",
  shadowOpacity: 0.5,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

export const shadowGlow = {
  shadowColor: colors.primary,
  shadowOpacity: 0.55,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 10,
} as const;
