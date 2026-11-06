import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { H2, Text } from "@/components/ui/Text";
import { GameCover } from "./GameCover";
import { StatusBadge } from "./StatusBadge";
import { useLibraryMap } from "@/hooks/use-library";
import { colors, radius } from "@/theme";
import type { GameSummary } from "@/lib/games";

const CARD_WIDTH = 124;

/** Horizontal row of games (same series / similar games). Tapping one opens its page. */
export function RelatedGames({ title, games }: { title: string; games: GameSummary[] }) {
  const library = useLibraryMap();
  if (games.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      <H2>{title}</H2>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {games.map((g) => {
          const entry = library.get(g.id);
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${g.name}`}
              onPress={() => router.push({ pathname: "/jogo/[id]", params: { id: String(g.id) } })}
              style={{ width: CARD_WIDTH, gap: 6 }}
            >
              <View style={styles.cover}>
                <GameCover src={g.cover} w={260} tall style={StyleSheet.absoluteFill} />
                {entry && <StatusBadge status={entry.status} overlay style={{ position: "absolute", left: 6, top: 6 }} />}
              </View>
              <Text weight="semibold" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
                {g.name}
              </Text>
              {g.year != null && (
                <Text muted style={{ fontSize: 12 }}>
                  {String(g.year)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: CARD_WIDTH,
    aspectRatio: 3 / 4,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
});
