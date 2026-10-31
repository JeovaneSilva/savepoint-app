import { useState } from "react";
import { View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { H2, Text } from "@/components/ui/Text";
import { useRemoveGame } from "@/hooks/use-library";
import { colors } from "@/theme";
import type { UserGame } from "@/lib/games";

export function RemoveGameButton({
  game,
  onRemoved,
  withLabel,
}: {
  game: Pick<UserGame, "id" | "name">;
  onRemoved?: () => void;
  withLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveGame();
  return (
    <>
      <Button
        variant="ghost"
        size={withLabel ? "sm" : "icon"}
        accessibilityLabel={`Remover ${game.name}`}
        icon={<Trash2 size={16} color={colors.mutedForeground} />}
        onPress={() => setOpen(true)}
        style={!withLabel ? { height: 36, width: 36, minWidth: 36 } : undefined}
      >
        {withLabel ? "Remover" : undefined}
      </Button>
      <Sheet visible={open} onClose={() => setOpen(false)} scroll={false}>
        <H2>{`Remover ${game.name}?`}</H2>
        <Text muted style={{ marginTop: 8, lineHeight: 20 }}>
          O jogo e todas as suas anotações sairão da sua biblioteca. Essa ação não pode ser desfeita.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <Button variant="ghost" onPress={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            loading={remove.isPending}
            onPress={() =>
              remove.mutate(game, {
                onSuccess: () => {
                  setOpen(false);
                  onRemoved?.();
                },
              })
            }
          >
            Remover
          </Button>
        </View>
      </Sheet>
    </>
  );
}
