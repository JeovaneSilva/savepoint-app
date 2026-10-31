import { useMemo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Bookmark, Gamepad2, Star, Trophy } from "lucide-react-native";
import { Card, EmptyState } from "@/components/Brand";
import { Donut, HBars, YearBars } from "@/components/Charts";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { H1, H2, Text } from "@/components/ui/Text";
import { GameCover } from "@/components/game/GameCover";
import { StarRating } from "@/components/game/StarRating";
import { useLibrary } from "@/hooks/use-library";
import { computeStats } from "@/lib/games";
import { colors, radius, shadowCard } from "@/theme";

export default function EstatisticasScreen() {
  const { data, isPending, isRefetching, refetch } = useLibrary();
  const games = useMemo(() => data ?? [], [data]);
  const s = useMemo(() => computeStats(games), [games]);

  if (isPending) {
    return (
      <Screen>
        <H1>Estatísticas</H1>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="48%" height={112} radius={radius["2xl"]} />
          ))}
        </View>
      </Screen>
    );
  }

  if (games.length === 0) {
    return (
      <Screen>
        <H1>Estatísticas</H1>
        <EmptyState
          icon={<Trophy size={40} color={colors.primary} />}
          title="Sem dados ainda"
          text="Adicione jogos à sua biblioteca para ver suas estatísticas."
          action={
            <Button variant="neon" onPress={() => router.navigate("/buscar")}>
              Buscar jogos
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <H1>Estatísticas</H1>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <StatCard icon={<Trophy size={20} color={colors.statusDone} />} label="Concluídos" value={s.counts.concluido} />
        <StatCard icon={<Gamepad2 size={20} color={colors.statusPlaying} />} label="Jogando" value={s.counts.jogando} />
        <StatCard icon={<Bookmark size={20} color={colors.statusWant} />} label="Quero jogar" value={s.counts.quero_jogar} />
        <StatCard
          icon={<Star size={20} color={colors.star} />}
          label="Média das notas"
          value={s.averageRating != null ? s.averageRating.toFixed(1).replace(".", ",") : "—"}
        />
      </View>

      <Panel title="Jogos concluídos por ano">
        {s.completedByYear.length === 0 ? (
          <Hint>Marque jogos como concluídos com data para ver este gráfico.</Hint>
        ) : (
          <YearBars data={s.completedByYear} />
        )}
        {s.completedWithoutDate > 0 && (
          <Text muted style={{ fontSize: 12, marginTop: 8 }}>
            {`${s.completedWithoutDate} ${s.completedWithoutDate === 1 ? "jogo zerado sem data não aparece" : "jogos zerados sem data não aparecem"} neste gráfico.`}
          </Text>
        )}
      </Panel>

      <Panel title="Por plataforma">
        {s.byPlatform.length === 0 ? (
          <Hint>Informe a plataforma em que jogou para ver este gráfico.</Hint>
        ) : (
          <Donut data={s.byPlatform} />
        )}
      </Panel>

      <Panel title="Por gênero">
        {s.byGenre.length === 0 ? <Hint>Nenhum gênero registrado ainda.</Hint> : <HBars data={s.byGenre} />}
      </Panel>

      <Panel title="Últimos 5 concluídos">
        {s.lastCompleted.length === 0 ? (
          <Hint>Nenhum jogo concluído ainda.</Hint>
        ) : (
          <View>
            {s.lastCompleted.map((g, i) => (
              <Pressable
                key={g.id}
                onPress={() => router.push({ pathname: "/jogo/[id]", params: { id: String(g.rawg_id) } })}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <GameCover src={g.cover_url} w={200} style={{ width: 48, height: 48, borderRadius: radius.lg }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold" numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text muted style={{ fontSize: 12 }}>
                    {[g.played_on, g.completed_at?.split("-").reverse().join("/")].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <StarRating value={g.rating} size="sm" />
              </Pressable>
            ))}
          </View>
        )}
      </Panel>
    </Screen>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <View
      style={{
        width: "48%",
        flexGrow: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius["2xl"],
        padding: 16,
        ...shadowCard,
      }}
    >
      <View style={{ marginBottom: 12 }}>{icon}</View>
      <Text display weight="bold" style={{ fontSize: 32, lineHeight: 38 }}>
        {String(value)}
      </Text>
      <Text muted>{label}</Text>
    </View>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={shadowCard}>
      <H2 style={{ fontSize: 18, marginBottom: 16 }}>{title}</H2>
      {children}
    </Card>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <Text muted style={{ textAlign: "center", paddingVertical: 40 }}>
      {children}
    </Text>
  );
}
