import { type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Camera, Clock, Medal, Pencil, ShieldCheck, Trash2, Trophy, UserRound } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { BadgeMedal, type BadgeInfo } from "@/components/BadgeMedal";
import { Card, EmptyState } from "@/components/Brand";
import { Backdrop } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { H1, H2, Text } from "@/components/ui/Text";
import { GameCover } from "@/components/game/GameCover";
import { useMyBadges, usePublicBadges, usePublicProfile, useRecentCompleted } from "@/hooks/use-badges";
import { useAccountStatus, usePendingCount } from "@/hooks/use-account";
import { useChangeAvatar, useRemoveAvatar } from "@/hooks/use-profile";
import { alpha, colors, radius, shadowCard } from "@/theme";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")}h`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

/** Profile of any user (found by nickname). On my own profile it also offers editing and shows badge progress. */
export function ProfileView({ nickname }: { nickname: string }) {
  const insets = useSafeAreaInsets();
  const profile = usePublicProfile(nickname);
  const p = profile.data;
  const isMe = !!p?.is_me;

  const myBadges = useMyBadges();
  const theirBadges = usePublicBadges(nickname, !!p && !isMe);
  const recent = useRecentCompleted(nickname, !!p);

  const account = useAccountStatus();
  const isAdmin = !!account.data?.is_admin;
  const pendingAccounts = usePendingCount(isAdmin);

  const changeAvatar = useChangeAvatar();
  const removeAvatar = useRemoveAvatar();

  const back = () => (router.canGoBack() ? router.back() : router.replace("/ranking"));

  const badges: BadgeInfo[] = isMe
    ? [...(myBadges.data ?? [])].sort((a, b) => Number(!!b.earned_at) - Number(!!a.earned_at))
    : (theirBadges.data ?? []);
  const earnedCount = isMe ? badges.filter((b) => b.earned_at).length : badges.length;
  const refreshing = profile.isRefetching || recent.isRefetching;

  const refetchAll = () => {
    void profile.refetch();
    void recent.refetch();
    void (isMe ? myBadges.refetch() : theirBadges.refetch());
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, gap: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={colors.primary} />}
      >
        <View style={{ paddingHorizontal: 12 }}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} color={colors.foreground} />} onPress={back} style={{ alignSelf: "flex-start" }}>
            Voltar
          </Button>
        </View>

        {profile.isPending ? (
          <View style={{ paddingHorizontal: 16, gap: 16, alignItems: "center" }}>
            <Skeleton width={104} height={104} radius={52} />
            <Skeleton width={160} height={28} />
            <Skeleton width="100%" height={90} radius={radius["2xl"]} />
          </View>
        ) : !p ? (
          <View style={{ paddingHorizontal: 16 }}>
            <EmptyState
              icon={<UserRound size={40} color={colors.mutedForeground} />}
              title={profile.isError ? "Não foi possível carregar o perfil" : "Perfil não encontrado"}
              text={
                profile.isError
                  ? "Verifique a conexão. Se continuar, confira se a migration 0004 foi executada no Supabase."
                  : "Esse apelido não existe ou foi alterado."
              }
              action={
                <Button variant="outline" onPress={profile.isError ? refetchAll : back}>
                  {profile.isError ? "Tentar de novo" : "Voltar"}
                </Button>
              }
            />
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
              <Pressable
                disabled={!isMe || changeAvatar.isPending}
                onPress={() => changeAvatar.mutate()}
                accessibilityLabel={isMe ? "Alterar foto de perfil" : undefined}
              >
                <Avatar nickname={p.nickname} path={p.avatar_path} version={p.avatar_updated_at} size={104} ring={isMe} />
                {isMe && (
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primary,
                      borderWidth: 2,
                      borderColor: colors.background,
                    }}
                  >
                    <Camera size={16} color={colors.primaryForeground} />
                  </View>
                )}
              </Pressable>
              <H1 style={{ textAlign: "center" }}>{p.nickname}</H1>
              <Text muted>
                {`No SavePoint desde ${MONTHS[new Date(p.member_since).getMonth()]}/${new Date(p.member_since).getFullYear()}`}
              </Text>

              {isMe && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 4 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={changeAvatar.isPending}
                    icon={<Camera size={14} color={colors.foreground} />}
                    onPress={() => changeAvatar.mutate()}
                  >
                    {p.avatar_path ? "Trocar foto" : "Adicionar foto"}
                  </Button>
                  {p.avatar_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={removeAvatar.isPending}
                      icon={<Trash2 size={14} color={colors.mutedForeground} />}
                      onPress={() => removeAvatar.mutate(p.avatar_path as string)}
                    >
                      Remover foto
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Pencil size={14} color={colors.foreground} />}
                    onPress={() => router.push("/apelido")}
                  >
                    Alterar apelido
                  </Button>
                  {isAdmin && (
                    <Button
                      variant={pendingAccounts > 0 ? "neon" : "outline"}
                      size="sm"
                      icon={<ShieldCheck size={14} color={pendingAccounts > 0 ? colors.primaryForeground : colors.foreground} />}
                      onPress={() => router.push("/aprovacoes")}
                    >
                      {pendingAccounts > 0 ? `Aprovar contas (${pendingAccounts})` : "Aprovar contas"}
                    </Button>
                  )}
                </View>
              )}
            </View>

            {/* Totals */}
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16 }}>
              <Stat icon={<Trophy size={18} color={colors.statusDone} />} value={String(p.completed_total)} label="Zerados" />
              <Stat icon={<Clock size={18} color={colors.accent} />} value={p.hours_total > 0 ? fmtHours(p.hours_total) : "—"} label="Horas" />
              <Stat icon={<Medal size={18} color={colors.star} />} value={String(earnedCount)} label="Selos" />
            </View>

            {/* Badges */}
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                <H2>Selos</H2>
                {isMe && badges.length > 0 && (
                  <Text muted style={{ fontSize: 12 }}>{`${earnedCount} de ${badges.length} conquistados`}</Text>
                )}
              </View>
              {(isMe ? myBadges.isPending : theirBadges.isPending) ? (
                <Skeleton width="100%" height={110} radius={radius["2xl"]} />
              ) : badges.length === 0 ? (
                <Card>
                  <Text muted style={{ textAlign: "center", paddingVertical: 12 }}>
                    {isMe ? "Zere jogos e preencha seus dados para desbloquear selos." : "Ainda sem selos."}
                  </Text>
                </Card>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 18, columnGap: "2%" }}>
                  {badges.map((b) => (
                    <BadgeMedal key={b.id} badge={b} />
                  ))}
                </View>
              )}
            </View>

            {/* Recently completed */}
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <H2>Últimos zerados</H2>
              {recent.isPending ? (
                <Skeleton width="100%" height={120} radius={radius["2xl"]} />
              ) : (recent.data ?? []).length === 0 ? (
                <Card>
                  <Text muted style={{ textAlign: "center", paddingVertical: 12 }}>
                    Nenhum jogo zerado ainda.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  {(recent.data ?? []).map((g) => (
                    <Pressable
                      key={g.igdb_id}
                      onPress={() => router.push({ pathname: "/jogo/[id]", params: { id: String(g.igdb_id) } })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 8,
                        borderRadius: radius.xl,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <GameCover src={g.cover_url} w={200} style={{ width: 52, height: 52, borderRadius: radius.lg }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text weight="semibold" numberOfLines={1}>
                          {g.name}
                        </Text>
                        <Text muted style={{ fontSize: 12 }}>
                          {g.completed_at ? `Zerado em ${fmtDate(g.completed_at)}` : "Zerado (data desconhecida)"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: 4,
        paddingVertical: 14,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: alpha(colors.card, 0.9),
        ...shadowCard,
      }}
    >
      {icon}
      <Text display weight="bold" style={{ fontSize: 24, lineHeight: 28 }}>
        {value}
      </Text>
      <Text muted style={{ fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}
