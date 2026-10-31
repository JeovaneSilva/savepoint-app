import { useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ghost, Pencil, Trophy } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { EmptyState } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { H1, Text } from "@/components/ui/Text";
import { supabase } from "@/lib/supabase";
import { alpha, colors, radius, shadowCard, shadowGlow } from "@/theme";

type Mode = "total" | "year";

interface Row {
  nickname: string;
  completed_total: number;
  completed_year: number;
  library_total: number;
  is_me: boolean;
}

interface Ranked extends Row {
  value: number;
  rank: number;
}

const MEDAL = [colors.star, "#c3c7d4", "#cd8a4b"]; // gold, silver, bronze

export default function RankingScreen() {
  const year = new Date().getFullYear();
  const [mode, setMode] = useState<Mode>("total");

  const q = useQuery({
    queryKey: ["ranking", year],
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("get_ranking", { p_year: year });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ranked = useMemo<Ranked[]>(() => {
    const pick = (r: Row) => (mode === "total" ? r.completed_total : r.completed_year);
    const sorted = [...(q.data ?? [])].sort(
      (a, b) => pick(b) - pick(a) || b.library_total - a.library_total || a.nickname.localeCompare(b.nickname, "pt-BR"),
    );
    // Equal scores share the same position (1, 2, 2, 4…).
    return sorted.map((r, i) => {
      const first = sorted.findIndex((x) => pick(x) === pick(r));
      return { ...r, value: pick(r), rank: first + 1 };
    });
  }, [q.data, mode]);

  const max = Math.max(1, ...ranked.map((r) => r.value));
  const me = ranked.find((r) => r.is_me);

  const header = (
    <View style={{ gap: 16, marginBottom: 16 }}>
      <View>
        <H1>Ranking</H1>
        <Text muted style={{ marginTop: 4, fontSize: 15 }}>
          {me ? `Você está em ${me.rank}º lugar` : "Quem mais zerou jogos"}
        </Text>
      </View>
      <Tabs
        value={mode}
        onChange={setMode}
        items={[
          { value: "total", label: "Total" },
          { value: "year", label: `Este ano (${year})` },
        ]}
      />
      {mode === "year" && (
        <Text muted style={{ fontSize: 12 }}>
          Só contam jogos zerados com data de conclusão neste ano. Os sem data entram apenas no Total.
        </Text>
      )}
      {q.isError && (
        <EmptyState
          icon={<Ghost size={40} color={colors.destructive} />}
          title="Não foi possível carregar o ranking"
          text="Verifique a conexão. Se o problema continuar, confira se a migration 0002 foi executada no Supabase."
          action={
            <Button variant="outline" onPress={() => q.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      )}
      {q.isPending && (
        <View style={{ gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={68} radius={radius.xl} />
          ))}
        </View>
      )}
      {!q.isPending && !q.isError && ranked.length > 0 && ranked.every((r) => r.value === 0) && (
        <Text muted style={{ textAlign: "center" }}>
          Ninguém concluiu um jogo ainda {mode === "year" ? "neste ano" : ""}. Seja o primeiro!
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <FlatList
        data={q.isError || q.isPending ? [] : ranked}
        keyExtractor={(r) => r.nickname}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        renderItem={({ item }) => <RankRow item={item} max={max} />}
        ListFooterComponent={
          <View style={{ alignItems: "center", paddingTop: 12 }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil size={14} color={colors.foreground} />}
              onPress={() => router.push("/apelido")}
            >
              Alterar meu apelido
            </Button>
          </View>
        }
      />
    </View>
  );
}

function RankRow({ item, max }: { item: Ranked; max: number }) {
  const medal = item.rank <= 3 && item.value > 0 ? MEDAL[item.rank - 1] : undefined;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: item.is_me ? alpha(colors.primary, 0.6) : colors.border,
          backgroundColor: item.is_me ? alpha(colors.primary, 0.1) : colors.card,
        },
        item.is_me ? shadowGlow : shadowCard,
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: medal ? alpha(medal, 0.18) : colors.secondary,
          borderWidth: 1,
          borderColor: medal ?? colors.border,
        }}
      >
        {medal && item.rank === 1 ? (
          <Trophy size={18} color={medal} />
        ) : (
          <Text display weight="bold" style={{ fontSize: 16, color: medal ?? colors.mutedForeground }}>
            {String(item.rank)}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1, fontSize: 15 }}>
            {item.nickname}
          </Text>
          {item.is_me && (
            <Text weight="semibold" style={{ color: colors.primaryGlow, fontSize: 12 }}>
              você
            </Text>
          )}
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.secondary, overflow: "hidden" }}>
          <View
            style={{
              height: 6,
              width: `${Math.round((item.value / max) * 100)}%`,
              backgroundColor: medal ?? colors.primary,
            }}
          />
        </View>
      </View>

      <View style={{ alignItems: "flex-end", minWidth: 56 }}>
        <Text display weight="bold" style={{ fontSize: 24, lineHeight: 28 }}>
          {String(item.value)}
        </Text>
        <Text muted style={{ fontSize: 11 }}>
          {item.value === 1 ? "zerado" : "zerados"}
        </Text>
      </View>
    </View>
  );
}
