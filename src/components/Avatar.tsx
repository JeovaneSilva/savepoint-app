import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Text } from "@/components/ui/Text";
import { avatarUrl } from "@/lib/avatar";
import { alpha, colors } from "@/theme";

/** Round profile photo; falls back to the nickname's initial when there is no (working) photo. */
export function Avatar({
  nickname,
  path,
  version,
  size = 40,
  ring,
}: {
  nickname: string;
  path?: string | null;
  version?: string | null;
  size?: number;
  /** Highlight ring (e.g. the signed-in user). */
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : avatarUrl(path, version);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: alpha(colors.primary, 0.22),
        borderWidth: ring ? 2 : 1,
        borderColor: ring ? colors.primary : colors.border,
      }}
    >
      {url ? (
        <Image
          key={url}
          source={{ uri: url }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel={`Foto de ${nickname}`}
        />
      ) : (
        <Text display weight="bold" style={{ fontSize: size * 0.42, color: colors.primaryGlow }}>
          {nickname.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
