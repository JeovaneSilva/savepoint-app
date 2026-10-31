import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { LayoutGrid, Library, List, Search } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { EmptyState } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { H1, Text } from "@/components/ui/Text";
import { ExportMenu } from "@/components/game/ExportMenu";
import { ImportButton } from "@/components/game/ImportButton";
import { LibraryGameCard, LibraryGameRow } from "@/components/game/GameCards";
import { GameEntryDialog, type EntryTarget } from "@/components/game/GameEntryDialog";
import { useLibrary } from "@/hooks/use-library";
import {
  SORT_OPTIONS,
  STATUSES,
  STATUS_TAB_LABEL,
  filterAndSortLibrary,
  type GameStatus,
  type LibraryFilters,
  type SortKey,
  type UserGame,
} from "@/lib/games";
import { alpha, colors, radius } from "@/theme";

export default function BibliotecaScreen() {
  const { data, isPending, isRefetching, refetch } = useLibrary();
  const games = useMemo(() => data ?? [], [data]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [target, setTarget] = useState<EntryTarget | null>(null);
  const [f, setF] = useState<LibraryFilters>({
    status: "all",
    playedOn: "all",
    genre: "all",
    minRating: 0,
    query: "",
    sort: "recent",
  });
  const set = <K extends keyof LibraryFilters>(k: K, v: LibraryFilters[K]) => setF((p) => ({ ...p, [k]: v }));

  const platforms = useMemo(() => [...new Set(games.map((g) => g.played_on).filter((p): p is string => !!p))].sort(), [games]);
  const genres = useMemo(() => [...new Set(games.flatMap((g) => g.genres))].sort(), [games]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: games.length };
    for (const s of STATUSES) c[s] = games.filter((g) => g.status === s).length;
    return c;
  }, [games]);

  const shown = useMemo(() => filterAndSortLibrary(games, f), [games, f]);
  const edit = (entry: UserGame) => setTarget({ mode: "edit", entry });
  const hasFilters = f.playedOn !== "all" || f.genre !== "all" || f.minRating > 0 || f.query.trim() !== "";

  if (isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, gap: 16 }}>
        <Backdrop />
        <Skeleton width={220} height={36} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: "48%", borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
              <Skeleton width="100%" style={{ aspectRatio: 3 / 2 }} radius={0} />
              <View style={{ padding: 12, gap: 8 }}>
                <Skeleton width="75%" height={16} />
                <Skeleton width="50%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (games.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, gap: 20 }}>
        <Backdrop />
        <H1>Minha Biblioteca</H1>
        <EmptyState
          icon={<Library size={40} color={colors.primary} />}
          title="Sua biblioteca está vazia"
          text="Busque os jogos que você já zerou ou quer jogar e comece sua coleção."
          action={
            <View style={{ gap: 10, alignItems: "center" }}>
              <Button variant="neon" onPress={() => router.navigate("/buscar")}>
                Buscar jogos
              </Button>
              <ImportButton />
            </View>
          }
        />
      </View>
    );
  }

  const header = (
    <View style={{ gap: 14, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexGrow: 1, minWidth: 200 }}>
          <H1>Minha Biblioteca</H1>
          <Text muted style={{ marginTop: 4 }}>
            {`${games.length} ${games.length === 1 ? "jogo registrado" : "jogos registrados"}`}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ImportButton />
          <ExportMenu games={games} />
        </View>
      </View>

      <View style={{ marginHorizontal: -16 }}>
        <Tabs
          scroll
          value={f.status}
          onChange={(v) => set("status", v as GameStatus | "all")}
          items={[
            { value: "all", label: "Todos", count: counts["all"] ?? 0 },
            ...STATUSES.map((s) => ({ value: s as string, label: STATUS_TAB_LABEL[s], count: counts[s] ?? 0 })),
          ]}
        />
      </View>

      <Input
        value={f.query}
        onChangeText={(t) => set("query", t)}
        placeholder="Buscar na minha lista"
        left={<Search size={16} color={colors.mutedForeground} />}
        accessibilityLabel="Buscar na minha lista"
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Select
          style={{ flex: 1 }}
          title="Plataforma"
          value={f.playedOn}
          onChange={(v) => set("playedOn", v)}
          options={[{ value: "all", label: "Todas as plataformas" }, ...platforms.map((p) => ({ value: p, label: p }))]}
        />
        <Select
          style={{ flex: 1 }}
          title="Gênero"
          value={f.genre}
          onChange={(v) => set("genre", v)}
          options={[{ value: "all", label: "Todos os gêneros" }, ...genres.map((g) => ({ value: g, label: g }))]}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Select
          style={{ flex: 1 }}
          title="Nota mínima"
          value={String(f.minRating)}
          onChange={(v) => set("minRating", Number(v))}
          options={[
            { value: "0", label: "Qualquer nota" },
            ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${n < 5 ? " ou mais" : ""}` })),
          ]}
        />
        <Select
          style={{ flex: 1.3 }}
          title="Ordenar por"
          value={f.sort}
          onChange={(v) => set("sort", v as SortKey)}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" }}>
          {(
            [
              ["grid", LayoutGrid, "Ver em grade"],
              ["list", List, "Ver em lista"],
            ] as const
          ).map(([v, Icon, label]) => (
            <Pressable
              key={v}
              accessibilityLabel={label}
              onPress={() => setView(v)}
              style={{
                width: 40,
                height: 36,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: view === v ? alpha(colors.primary, 0.2) : "transparent",
              }}
            >
              <Icon size={16} color={view === v ? colors.foreground : colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      {shown.length === 0 && (
        <EmptyState
          icon={<Search size={40} color={colors.mutedForeground} />}
          title="Nada por aqui"
          text={hasFilters ? "Nenhum jogo combina com esses filtros." : "Nenhum jogo com esse status ainda."}
          action={
            hasFilters ? (
              <Button variant="outline" onPress={() => setF((p) => ({ ...p, playedOn: "all", genre: "all", minRating: 0, query: "" }))}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <FlatList
        // numColumns can't change on the fly, so remount when the layout changes.
        key={view}
        data={shown}
        numColumns={view === "grid" ? 2 : 1}
        keyExtractor={(g) => g.id}
        columnWrapperStyle={view === "grid" ? { gap: 10 } : undefined}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: view === "grid" ? 10 : 8 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          view === "grid" ? (
            <View style={{ flex: 1, maxWidth: "50%" }}>
              <LibraryGameCard game={item} onEdit={edit} />
            </View>
          ) : (
            <LibraryGameRow game={item} onEdit={edit} />
          )
        }
      />
      <GameEntryDialog target={target} onClose={() => setTarget(null)} />
    </View>
  );
}
