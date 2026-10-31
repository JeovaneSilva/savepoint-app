import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Ghost, KeyRound, X } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { Card, EmptyState } from "@/components/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { H2, Text } from "@/components/ui/Text";
import { GameCover } from "@/components/game/GameCover";
import { GameEntryForm, type EntryValues } from "@/components/game/GameEntryForm";
import { RemoveGameButton } from "@/components/game/RemoveGameButton";
import { StatusBadge } from "@/components/game/StatusBadge";
import { libraryQuery, useAddGame, useUpdateGame } from "@/hooks/use-library";
import { getGameDetails, type DetailsResponse } from "@/lib/rawg";
import { rawgThumb, type GameDetails, type UserGame } from "@/lib/games";
import { alpha, colors, radius, shadowGlow } from "@/theme";

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rawgId = Number(id);
  const insets = useSafeAreaInsets();
  const [shot, setShot] = useState<string | null>(null);

  const { data: library } = useQuery(libraryQuery);
  const entry = library?.find((g) => g.rawg_id === rawgId);

  // Games already in the library open instantly with what is stored; the rest loads in the background.
  const placeholder: DetailsResponse | undefined = entry
    ? {
        game: {
          id: entry.rawg_id,
          name: entry.name,
          cover: entry.cover_url,
          year: entry.release_year,
          platforms: entry.platforms,
          parentPlatforms: [],
          genres: entry.genres,
          metacritic: null,
          released: null,
          description: "",
          developers: [],
          publishers: [],
          website: null,
          screenshots: [],
        },
      }
    : undefined;

  const details = useQuery({
    queryKey: ["rawg-game", rawgId],
    queryFn: async () => {
      const res = await getGameDetails(rawgId);
      // Throw on transient failures so they are neither cached nor saved on the device.
      if (res.error === "unavailable" || res.error === "quota") throw new Error(res.error);
      return res;
    },
    enabled: Number.isInteger(rawgId) && rawgId > 0,
    staleTime: 30 * 24 * 60 * 60 * 1000, // details rarely change; also cached on the device
    retry: false,
    ...(placeholder ? { placeholderData: placeholder } : {}),
  });
  const loadingExtra = details.isPlaceholderData;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/biblioteca"));
  const g = details.data?.game;

  const backButton = (
    <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} color={colors.foreground} />} onPress={back} style={{ alignSelf: "flex-start" }}>
      Voltar
    </Button>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, gap: 24 }}>
        <View style={{ paddingHorizontal: 12 }}>{backButton}</View>

        {details.isPending ? (
          <View style={{ paddingHorizontal: 16, gap: 16 }}>
            <Skeleton width="100%" style={{ aspectRatio: 16 / 9 }} radius={radius["2xl"]} />
            <Skeleton width="50%" height={32} />
            <Skeleton width="100%" height={128} />
          </View>
        ) : !g ? (
          <View style={{ paddingHorizontal: 16 }}>
            {details.isError && details.error.message === "quota" ? (
              <EmptyState
                icon={<Ghost size={40} color={colors.statusWant} />}
                title="Limite mensal da base de jogos atingido"
                text="Os detalhes de jogos novos voltam no mês que vem. Jogos já abertos continuam disponíveis."
              />
            ) : details.isError ? (
              <EmptyState
                icon={<Ghost size={40} color={colors.destructive} />}
                title="Não foi possível carregar o jogo"
                text="Verifique a conexão e tente de novo."
                action={
                  <Button variant="outline" onPress={() => details.refetch()}>
                    Tentar de novo
                  </Button>
                }
              />
            ) : details.data?.error === "missing_key" ? (
              <EmptyState
                icon={<KeyRound size={40} color={colors.accent} />}
                title="A base de jogos ainda não está conectada"
                text="Assim que a chave for adicionada, os detalhes aparecem aqui."
              />
            ) : (
              <EmptyState
                icon={<Ghost size={40} color={colors.mutedForeground} />}
                title={details.data?.error === "not_found" ? "Jogo não encontrado" : "Não foi possível carregar o jogo"}
                text="Volte para a busca e tente outro título."
                action={
                  <Button variant="outline" onPress={() => router.replace("/buscar")}>
                    Ir para a busca
                  </Button>
                }
              />
            )}
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={{ marginHorizontal: 16, borderRadius: radius["2xl"], overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
              <View style={{ aspectRatio: 16 / 9 }}>
                <GameCover src={g.cover} w={1280} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={["transparent", alpha(colors.background, 0.7), colors.background]}
                  locations={[0.3, 0.75, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={{ marginTop: -48, paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}>
                {entry && <StatusBadge status={entry.status} overlay />}
                <Text display weight="bold" style={{ fontSize: 28, lineHeight: 33 }}>
                  {g.name}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  {g.year != null && <Text weight="semibold">{String(g.year)}</Text>}
                  {g.metacritic != null && <Badge variant="concluido">{`Metacritic ${g.metacritic}`}</Badge>}
                  {g.genres.map((x) => (
                    <Badge key={x} variant="neon">
                      {x}
                    </Badge>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, gap: 28 }}>
              <View style={{ gap: 12 }}>
                <H2>Sobre o jogo</H2>
                {loadingExtra ? (
                  <View style={{ gap: 8 }}>
                    <Skeleton width="100%" height={14} />
                    <Skeleton width="92%" height={14} />
                    <Skeleton width="60%" height={14} />
                  </View>
                ) : (
                  <Text muted style={{ lineHeight: 22, fontSize: 15 }}>
                    {g.description || "Sem descrição disponível."}
                  </Text>
                )}
              </View>

              {loadingExtra ? (
                <Skeleton width="100%" height={200} radius={radius["2xl"]} />
              ) : (
              <Card style={{ gap: 16 }}>
                <Info label="Desenvolvedora" value={g.developers.join(", ")} />
                <Info label="Publicadora" value={g.publishers.join(", ")} />
                <Info label="Lançamento" value={g.released ? g.released.split("-").reverse().join("/") : ""} />
                <View>
                  <Text muted weight="semibold" style={styles.infoLabel}>
                    Plataformas
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {g.platforms.map((p) => (
                      <Badge key={p} variant="secondary">
                        {p}
                      </Badge>
                    ))}
                  </View>
                </View>
                {g.website && (
                  <Pressable onPress={() => Linking.openURL(g.website as string)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: colors.accent }}>Site oficial</Text>
                    <ExternalLink size={14} color={colors.accent} />
                  </Pressable>
                )}
              </Card>
              )}

              {g.screenshots.length > 0 && (
                <View style={{ gap: 12 }}>
                  <H2>Screenshots</H2>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {g.screenshots.map((s) => (
                      <Pressable key={s} onPress={() => setShot(s)} style={{ width: "48.5%" }}>
                        <Image
                          source={{ uri: rawgThumb(s, 640) ?? s }}
                          contentFit="cover"
                          transition={250}
                          accessibilityLabel={`Screenshot de ${g.name}`}
                          style={{ aspectRatio: 16 / 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* My data */}
              <View
                style={{
                  gap: 16,
                  backgroundColor: colors.card,
                  borderRadius: radius["2xl"],
                  borderWidth: 1,
                  borderColor: alpha(colors.primary, 0.4),
                  padding: 16,
                  ...shadowGlow,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <H2>{entry ? "Meus dados" : "Adicionar à biblioteca"}</H2>
                  {entry && <RemoveGameButton game={entry} withLabel onRemoved={back} />}
                </View>
                <MyDataForm key={entry?.id ?? "new"} rawg={g} entry={entry} />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!shot} transparent animationType="fade" onRequestClose={() => setShot(null)} statusBarTranslucent>
        <Pressable style={styles.lightbox} onPress={() => setShot(null)}>
          {shot && (
            <Image source={{ uri: shot }} contentFit="contain" style={{ width: "100%", aspectRatio: 16 / 9 }} />
          )}
          <View style={{ position: "absolute", top: insets.top + 12, right: 16 }}>
            <Button variant="glass" size="icon" accessibilityLabel="Fechar" icon={<X size={18} color={colors.foreground} />} onPress={() => setShot(null)} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text muted weight="semibold" style={styles.infoLabel}>
        {label}
      </Text>
      <Text weight="medium" style={{ marginTop: 4 }}>
        {value || "—"}
      </Text>
    </View>
  );
}

function MyDataForm({ rawg, entry }: { rawg: GameDetails; entry: UserGame | undefined }) {
  const add = useAddGame();
  const update = useUpdateGame();
  const initial: EntryValues = entry
    ? {
        status: entry.status,
        played_on: entry.played_on,
        rating: entry.rating,
        completed_at: entry.completed_at,
        completed_date_unknown: entry.completed_date_unknown ?? false,
        hours_played: entry.hours_played ?? null,
        notes: entry.notes,
      }
    : {
        status: "quero_jogar",
        played_on: null,
        rating: null,
        completed_at: null,
        completed_date_unknown: false,
        hours_played: null,
        notes: null,
      };

  return (
    <GameEntryForm
      initial={initial}
      platforms={rawg.platforms}
      submitLabel={entry ? "Salvar alterações" : "Adicionar"}
      pending={add.isPending || update.isPending}
      onSubmit={(v) => {
        if (entry) {
          update.mutate({ id: entry.id, patch: v });
        } else {
          add.mutate({
            rawg_id: rawg.id,
            name: rawg.name,
            cover_url: rawg.cover,
            release_year: rawg.year,
            platforms: rawg.platforms,
            genres: rawg.genres,
            ...v,
          });
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  infoLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
});
