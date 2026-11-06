import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Pencil, Trophy } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { GameCover } from "./GameCover";
import { PlatformIcons } from "./PlatformIcons";
import { RemoveGameButton } from "./RemoveGameButton";
import { StarRating } from "./StarRating";
import { StatusBadge } from "./StatusBadge";
import { alpha, colors, radius, shadowCard } from "@/theme";
import type { GameStatus, GameSummary, UserGame } from "@/lib/games";

const openGame = (igdbId: number) => router.push({ pathname: "/jogo/[id]", params: { id: String(igdbId) } });

function formatDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** 3:2 cover with the bottom fade used on the web cards. */
function CardCover({ src, children }: { src: string | null; children?: React.ReactNode }) {
  return (
    <View style={{ aspectRatio: 3 / 2, overflow: "hidden" }}>
      <GameCover src={src} w={420} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", alpha(colors.background, 0.8)]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" }}
      />
      {children}
    </View>
  );
}

/* ---------------- Search ---------------- */

export function SearchGameCard({
  game,
  entry,
  onAdd,
}: {
  game: GameSummary;
  entry?: UserGame | undefined;
  onAdd: (game: GameSummary, status: GameStatus) => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={() => openGame(game.id)} accessibilityLabel={`Ver ${game.name}`}>
        <CardCover src={game.cover}>
          {game.criticScore != null && (
            <View style={styles.metacritic}>
              <Text display weight="bold" style={{ fontSize: 12, color: colors.statusDone }}>
                {String(game.criticScore)}
              </Text>
            </View>
          )}
          {entry && <StatusBadge status={entry.status} overlay style={{ position: "absolute", left: 8, top: 8 }} />}
        </CardCover>
      </Pressable>
      <View style={styles.body}>
        <Text weight="semibold" numberOfLines={2} onPress={() => openGame(game.id)} style={{ fontSize: 14, lineHeight: 19 }}>
          {game.name}
        </Text>
        <Text muted style={{ fontSize: 12 }}>
          {game.year ? String(game.year) : "—"}
        </Text>
        <PlatformIcons slugs={game.parentPlatforms} max={4} />
        <View style={{ marginTop: "auto", paddingTop: 4, gap: 6 }}>
          {entry ? (
            <Text muted style={{ fontSize: 12 }}>
              Já está na sua biblioteca
            </Text>
          ) : (
            <>
              <Button size="sm" variant="done" fullWidth icon={<Trophy size={14} color={colors.statusDone} />} onPress={() => onAdd(game, "concluido")}>
                Já zerei
              </Button>
              <Button size="sm" variant="want" fullWidth icon={<Bookmark size={14} color={colors.statusWant} />} onPress={() => onAdd(game, "quero_jogar")}>
                Quero jogar
              </Button>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function GameCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" style={{ aspectRatio: 3 / 2 }} radius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        <Skeleton width="75%" height={16} />
        <Skeleton width="25%" height={12} />
        <Skeleton height={32} />
      </View>
    </View>
  );
}

/* ---------------- Library ---------------- */

interface LibProps {
  game: UserGame;
  onEdit: (g: UserGame) => void;
}

export function LibraryGameCard({ game, onEdit }: LibProps) {
  return (
    <View style={styles.card}>
      <Pressable onPress={() => openGame(game.igdb_id)} accessibilityLabel={`Ver ${game.name}`}>
        <CardCover src={game.cover_url}>
          <StatusBadge status={game.status} overlay style={{ position: "absolute", left: 8, top: 8 }} />
        </CardCover>
      </Pressable>
      <View style={[styles.body, { gap: 6 }]}>
        <Text weight="semibold" numberOfLines={2} onPress={() => openGame(game.igdb_id)} style={{ fontSize: 14, lineHeight: 19 }}>
          {game.name}
        </Text>
        <Text muted numberOfLines={1} style={{ fontSize: 12 }}>
          {[game.played_on, game.release_year].filter(Boolean).join(" · ") || "—"}
        </Text>
        <View style={{ marginTop: "auto", paddingTop: 4 }}>
          <StarRating value={game.rating} size="sm" />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginRight: -8, marginTop: 2 }}>
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel={`Editar ${game.name}`}
              icon={<Pencil size={16} color={colors.foreground} />}
              onPress={() => onEdit(game)}
              style={{ height: 36, width: 36, minWidth: 36 }}
            />
            <RemoveGameButton game={game} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function LibraryGameRow({ game, onEdit }: LibProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => openGame(game.igdb_id)}>
        <GameCover src={game.cover_url} w={200} style={{ width: 64, height: 64, borderRadius: radius.lg }} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text weight="semibold" numberOfLines={1} onPress={() => openGame(game.igdb_id)}>
          {game.name}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4 }}>
          <StatusBadge status={game.status} />
          {game.played_on && (
            <Text muted style={{ fontSize: 12 }}>
              {game.played_on}
            </Text>
          )}
          {game.release_year && (
            <Text muted style={{ fontSize: 12 }}>
              {String(game.release_year)}
            </Text>
          )}
          {game.completed_at && (
            <Text muted style={{ fontSize: 12 }}>{`Zerado em ${formatDate(game.completed_at)}`}</Text>
          )}
          {game.status === "concluido" && !game.completed_at && (
            <Text muted style={{ fontSize: 12 }}>Zerado (data desconhecida)</Text>
          )}
          {game.hours_played != null && (
            <Text muted style={{ fontSize: 12 }}>{`${String(game.hours_played).replace(".", ",")}h`}</Text>
          )}
        </View>
        {game.rating != null && <StarRating value={game.rating} size="sm" />}
      </View>
      <View>
        <Button
          variant="ghost"
          size="icon"
          accessibilityLabel={`Editar ${game.name}`}
          icon={<Pencil size={16} color={colors.foreground} />}
          onPress={() => onEdit(game)}
          style={{ height: 36, width: 36, minWidth: 36 }}
        />
        <RemoveGameButton game={game} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    ...shadowCard,
  },
  body: { flex: 1, padding: 10, gap: 6 },
  metacritic: {
    position: "absolute",
    top: 8,
    right: 8,
    borderWidth: 1,
    borderColor: alpha(colors.statusDone, 0.5),
    backgroundColor: alpha(colors.background, 0.85),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
});
