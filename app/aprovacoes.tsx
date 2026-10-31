import { useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, ShieldX, Undo2, Users } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { Card, EmptyState } from "@/components/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { H1, H2, Text } from "@/components/ui/Text";
import { useAccountStatus, useAdminAccounts, useSetAccountStatus, type AccountRow, type AccountState } from "@/hooks/use-account";
import { colors, radius } from "@/theme";

const ORDER: AccountState[] = ["pending", "approved", "blocked"];
const TITLE: Record<AccountState, string> = { pending: "Aguardando aprovação", approved: "Aprovadas", blocked: "Bloqueadas" };

type Item = { type: "title"; state: AccountState; count: number } | { type: "row"; row: AccountRow };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Admin only: approve or block accounts. */
export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const account = useAccountStatus();
  const isAdmin = !!account.data?.is_admin;
  const list = useAdminAccounts(isAdmin);
  const setStatus = useSetAccountStatus();

  const items = useMemo<Item[]>(() => {
    const rows = list.data ?? [];
    return ORDER.flatMap((state) => {
      const group = rows.filter((r) => r.status === state);
      return group.length ? [{ type: "title" as const, state, count: group.length }, ...group.map((row) => ({ type: "row" as const, row }))] : [];
    });
  }, [list.data]);

  if (!account.isPending && !isAdmin) return <Redirect href="/biblioteca" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/meu-perfil"));

  const header = (
    <View style={{ gap: 6, marginBottom: 12 }}>
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} color={colors.foreground} />} onPress={back} style={{ alignSelf: "flex-start", marginLeft: -8 }}>
        Voltar
      </Button>
      <H1>Aprovações</H1>
      <Text muted>Quem cria uma conta só entra depois que você aprovar aqui.</Text>
      {list.isPending && (
        <View style={{ gap: 10, marginTop: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={92} radius={radius.xl} />
          ))}
        </View>
      )}
      {list.isError && (
        <EmptyState
          icon={<ShieldX size={40} color={colors.destructive} />}
          title="Não foi possível carregar as contas"
          text="Confira se a migration 0007 foi executada e se você está cadastrado como administrador."
          action={
            <Button variant="outline" onPress={() => void list.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      )}
      {!list.isPending && !list.isError && items.length === 0 && (
        <EmptyState icon={<Users size={40} color={colors.mutedForeground} />} title="Nenhuma conta ainda" text="Quando alguém se cadastrar, aparece aqui." />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <FlatList
        data={list.isError || list.isPending ? [] : items}
        keyExtractor={(i) => (i.type === "title" ? `t-${i.state}` : i.row.user_id)}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.type === "title" ? (
            <H2 style={{ fontSize: 16, marginTop: 8 }}>{`${TITLE[item.state]} (${item.count})`}</H2>
          ) : (
            <AccountCard row={item.row} busy={setStatus.isPending && setStatus.variables?.userId === item.row.user_id} onSet={(status) => setStatus.mutate({ userId: item.row.user_id, status })} />
          )
        }
      />
    </View>
  );
}

function AccountCard({ row, busy, onSet }: { row: AccountRow; busy: boolean; onSet: (s: AccountState) => void }) {
  return (
    <Card style={{ gap: 12, padding: 14, borderRadius: radius.xl }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1, fontSize: 15 }}>
            {row.nickname ?? "Sem apelido"}
          </Text>
          <Badge variant={row.status === "approved" ? "concluido" : row.status === "blocked" ? "abandonado" : "quero_jogar"}>
            {row.status === "approved" ? "Aprovada" : row.status === "blocked" ? "Bloqueada" : "Pendente"}
          </Badge>
        </View>
        <Text muted numberOfLines={1} style={{ fontSize: 13 }}>
          {row.email}
        </Text>
        <Text muted style={{ fontSize: 12 }}>{`Criada em ${fmt(row.created_at)}`}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {row.status !== "approved" && (
          <Button size="sm" variant="done" loading={busy} icon={<Check size={14} color={colors.statusDone} />} onPress={() => onSet("approved")}>
            Aprovar
          </Button>
        )}
        {row.status !== "blocked" && (
          <Button size="sm" variant="outline" disabled={busy} icon={<ShieldX size={14} color={colors.destructive} />} onPress={() => onSet("blocked")}>
            Bloquear
          </Button>
        )}
        {row.status === "blocked" && (
          <Button size="sm" variant="ghost" disabled={busy} icon={<Undo2 size={14} color={colors.foreground} />} onPress={() => onSet("pending")}>
            Voltar para pendente
          </Button>
        )}
      </View>
    </Card>
  );
}
