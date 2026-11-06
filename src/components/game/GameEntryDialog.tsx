import { View } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { GameCover } from "./GameCover";
import { GameEntryForm, todayISO, type EntryValues } from "./GameEntryForm";
import { useAddGame, useUpdateGame } from "@/hooks/use-library";
import { radius } from "@/theme";
import type { GameStatus, GameSummary, UserGame } from "@/lib/games";

export type EntryTarget =
  | { mode: "add"; game: GameSummary; status: GameStatus }
  | { mode: "edit"; entry: UserGame };

export function GameEntryDialog({ target, onClose }: { target: EntryTarget | null; onClose: () => void }) {
  const add = useAddGame();
  const update = useUpdateGame();

  const name = target ? (target.mode === "add" ? target.game.name : target.entry.name) : "";
  const cover = target ? (target.mode === "add" ? target.game.cover : target.entry.cover_url) : null;
  const platforms = target ? (target.mode === "add" ? target.game.platforms : target.entry.platforms) : [];

  const initial: EntryValues | null = !target
    ? null
    : target.mode === "add"
      ? {
          status: target.status,
          played_on:
            target.status !== "quero_jogar" && target.game.platforms.length === 1
              ? (target.game.platforms[0] ?? null)
              : null,
          rating: null,
          completed_at: target.status === "concluido" ? todayISO() : null,
          completed_date_unknown: false,
          hours_played: null,
          notes: null,
        }
      : {
          status: target.entry.status,
          played_on: target.entry.played_on,
          rating: target.entry.rating,
          completed_at: target.entry.completed_at,
          completed_date_unknown: target.entry.completed_date_unknown ?? false,
          hours_played: target.entry.hours_played ?? null,
          notes: target.entry.notes,
        };

  const handleSubmit = (v: EntryValues) => {
    if (!target) return;
    if (target.mode === "add") {
      const g = target.game;
      add.mutate(
        { igdb_id: g.id, name: g.name, cover_url: g.cover, release_year: g.year, platforms: g.platforms, genres: g.genres, ...v },
        { onSuccess: onClose },
      );
    } else {
      update.mutate({ id: target.entry.id, patch: v }, { onSuccess: onClose });
    }
  };

  return (
    <Sheet visible={!!target} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <GameCover src={cover} w={200} style={{ width: 56, height: 56, borderRadius: radius.lg }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text display weight="semibold" numberOfLines={1} style={{ fontSize: 20 }}>
            {name}
          </Text>
          <Text muted>{target?.mode === "add" ? "Adicionar à minha biblioteca" : "Editar meus dados"}</Text>
        </View>
      </View>
      {initial && (
        <GameEntryForm
          key={target?.mode === "add" ? `add-${target.game.id}-${target.status}` : `edit-${target?.entry.id}`}
          initial={initial}
          platforms={platforms}
          submitLabel={target?.mode === "add" ? "Adicionar" : "Salvar"}
          pending={add.isPending || update.isPending}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      )}
    </Sheet>
  );
}
