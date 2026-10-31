import { useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Flame, Ghost, KeyRound, Search, X } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { EmptyState, RawgAttribution } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Chips } from "@/components/ui/Tabs";
import { H1, Text } from "@/components/ui/Text";
import { GameCardSkeleton, SearchGameCard } from "@/components/game/GameCards";
import { GameEntryDialog, type EntryTarget } from "@/components/game/GameEntryDialog";
import { useDebounced } from "@/hooks/use-debounced";
import { useLibraryMap } from "@/hooks/use-library";
import { searchGames } from "@/lib/rawg";
import { DECADES, PLATFORM_GROUPS, TRENDING_SIZE, effectiveSearch, type GameSummary, type PlatformGroup } from "@/lib/games";
import { colors } from "@/theme";

type Item = GameSummary | { skeleton: number };
const isSkeleton = (i: Item): i is { skeleton: number } => "skeleton" in i;

export default function BuscarScreen() {
  const [term, setTerm] = useState("");
  const [platform, setPlatform] = useState<PlatformGroup | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [target, setTarget] = useState<EntryTarget | null>(null);
  const search = effectiveSearch(useDebounced(term, 400));
  const trending = !search;
  const library = useLibraryMap();

  const q = useInfiniteQuery({
    queryKey: ["rawg-search", search, platform, decade],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchGames({ search, platform, decade, page: pageParam }),
    getNextPageParam: (last, all) => (last.hasMore && !last.error ? all.length + 1 : undefined),
    staleTime: 10 * 60_000,
    // Keep showing the previous results while the next search loads (no skeleton flash).
    placeholderData: keepPreviousData,
  });

  const results = q.data?.pages.flatMap((p) => p.results) ?? [];
  const error = q.data?.pages[0]?.error;
  const refreshing = q.isPlaceholderData && q.isFetching;
  const failed = error === "unavailable" || q.isError;

  const data: Item[] = q.isPending
    ? Array.from({ length: trending ? TRENDING_SIZE : 8 }, (_, i) => ({ skeleton: i }))
    : error || failed
      ? []
      : results;

  const header = (
    <View style={{ gap: 16, marginBottom: 16 }}>
      <View>
        <H1>Buscar jogos</H1>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          {trending ? (
            <>
              <Flame size={16} color={colors.accent} />
              <Text muted style={{ fontSize: 15 }}>
                Em alta agora — ou busque pelo nome
              </Text>
            </>
          ) : (
            <Text muted numberOfLines={1} style={{ fontSize: 15, flexShrink: 1 }}>{`Resultados para “${search}”`}</Text>
          )}
          {refreshing && <ActivityIndicator size="small" color={colors.mutedForeground} />}
        </View>
      </View>

      <Input
        value={term}
        onChangeText={setTerm}
        placeholder="Ex.: Super Mario World"
        height={48}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Buscar jogo"
        left={<Search size={20} color={colors.mutedForeground} />}
        right={
          term ? (
            <X size={16} color={colors.mutedForeground} onPress={() => setTerm("")} accessibilityLabel="Limpar busca" />
          ) : undefined
        }
        containerStyle={{ borderRadius: 12 }}
      />

      <View style={{ marginHorizontal: -16 }}>
        <Chips
          value={platform ?? "all"}
          onChange={(v) => setPlatform(v === "all" ? null : (v as PlatformGroup))}
          items={[{ value: "all", label: "Todas" }, ...PLATFORM_GROUPS.map((p) => ({ value: p.value as string, label: p.label }))]}
        />
      </View>

      <Select
        title="Década"
        value={decade ? String(decade) : "all"}
        onChange={(v) => setDecade(v === "all" ? null : Number(v))}
        options={[
          { value: "all", label: "Qualquer década" },
          ...DECADES.map((d) => ({ value: String(d), label: `Anos ${String(d).slice(2)}` })),
        ]}
      />

      {error === "missing_key" ? (
        <EmptyState
          icon={<KeyRound size={40} color={colors.accent} />}
          title="A busca ainda não está ativada"
          text="Falta conectar a chave da base de jogos. Assim que ela for adicionada, a busca funciona aqui."
        />
      ) : error === "quota" ? (
        <EmptyState
          icon={<Ghost size={40} color={colors.statusWant} />}
          title="Limite mensal da base de jogos atingido"
          text="Novas buscas voltam no mês que vem. Jogos já consultados continuam disponíveis."
        />
      ) : failed ? (
        <EmptyState
          icon={<Ghost size={40} color={colors.destructive} />}
          title="A base de jogos não respondeu"
          text="Tente novamente em alguns instantes."
          action={
            <Button variant="outline" onPress={() => q.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : !q.isPending && results.length === 0 ? (
        <EmptyState
          icon={<Ghost size={40} color={colors.mutedForeground} />}
          title="Nenhum jogo encontrado"
          text="Tente outro nome ou remova os filtros de plataforma e década."
        />
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <FlatList
        data={data}
        numColumns={2}
        keyExtractor={(g) => (isSkeleton(g) ? `s${g.skeleton}` : String(g.id))}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: "50%", opacity: refreshing ? 0.6 : 1 }}>
            {isSkeleton(item) ? (
              <GameCardSkeleton />
            ) : (
              <SearchGameCard
                game={item}
                entry={library.get(item.id)}
                onAdd={(game, status) => setTarget({ mode: "add", game, status })}
              />
            )}
          </View>
        )}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        ListFooterComponent={
          <View style={{ paddingTop: 12, gap: 16, alignItems: "center" }}>
            {q.isFetchingNextPage && <ActivityIndicator color={colors.mutedForeground} />}
            <RawgAttribution />
          </View>
        }
      />
      <GameEntryDialog target={target} onClose={() => setTarget(null)} />
    </View>
  );
}
