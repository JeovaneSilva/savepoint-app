import { useState } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Gamepad2 } from "lucide-react-native";
import { alpha, colors } from "@/theme";
import { igdbThumb, imageRatio, isLandscapeRatio } from "@/lib/games";

/**
 * Game artwork with graceful fallbacks: resized image, then the original,
 * then a placeholder — so a CDN hiccup never shows a broken image.
 *
 * Covers are 3:4 posters. `tall` = the box is a poster-shaped card: a 3:4 cover fills it; any other shape (a screenshot
 * fallback) is shown whole over a blurred copy of itself. `wide` = a wide banner: posters and squares get the same
 * treatment. Square thumbnails show the top of a poster (where the title usually is).
 */
export function GameCover({
  src,
  w = 640,
  wide = false,
  tall = false,
  style,
}: {
  src: string | null | undefined;
  w?: number;
  wide?: boolean;
  tall?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const thumb = igdbThumb(src, w);
  const [attempt, setAttempt] = useState(0);
  const url = attempt === 0 ? thumb : attempt === 1 && src && src !== thumb ? src : null;

  if (!url) {
    return (
      <View style={[styles.placeholder, style]}>
        <Gamepad2 size={32} color={alpha(colors.mutedForeground, 0.5)} />
      </View>
    );
  }
  const ratio = imageRatio(src);
  const isPoster = ratio != null && ratio < 0.95;
  const showWhole = (wide && !isLandscapeRatio(ratio)) || (tall && ratio != null && !isPoster);
  if (showWhole) {
    return (
      <View style={[{ overflow: "hidden", backgroundColor: colors.secondary }, style]}>
        <Image
          source={{ uri: url }}
          contentFit="cover"
          blurRadius={Platform.OS === "web" ? 0 : 40}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(7, 7, 17, 0.45)" }]} />
        <Image
          source={{ uri: url }}
          contentFit="contain"
          transition={250}
          cachePolicy="memory-disk"
          onError={() => setAttempt((a) => (a === 0 && src && src !== thumb ? 1 : 2))}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      contentFit="cover"
      contentPosition={isPoster && !wide && !tall ? "top" : "center"}
      transition={250}
      cachePolicy="memory-disk"
      onError={() => setAttempt((a) => (a === 0 && src && src !== thumb ? 1 : 2))}
      style={[{ backgroundColor: colors.secondary }, style as object]}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
});
