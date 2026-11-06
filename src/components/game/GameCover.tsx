import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Gamepad2 } from "lucide-react-native";
import { alpha, colors } from "@/theme";
import { igdbThumb } from "@/lib/games";

/**
 * Game artwork with graceful fallbacks: resized image, then the original,
 * then a placeholder — so a CDN hiccup never shows a broken image.
 */
export function GameCover({
  src,
  w = 640,
  style,
}: {
  src: string | null | undefined;
  w?: number;
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
  return (
    <Image
      source={{ uri: url }}
      contentFit="cover"
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
