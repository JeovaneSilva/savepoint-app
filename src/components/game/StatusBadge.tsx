import type { StyleProp, ViewStyle } from "react-native";
import { Bookmark, CheckCircle2, Gamepad2, XCircle } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { colors } from "@/theme";
import { STATUS_LABEL, type GameStatus } from "@/lib/games";

const META = {
  concluido: { Icon: CheckCircle2, color: colors.statusDone },
  jogando: { Icon: Gamepad2, color: colors.statusPlaying },
  quero_jogar: { Icon: Bookmark, color: colors.statusWant },
  abandonado: { Icon: XCircle, color: colors.statusDropped },
} as const;

export function StatusBadge({
  status,
  overlay,
  style,
}: {
  status: GameStatus;
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { Icon, color } = META[status];
  return (
    <Badge variant={status} overlay={overlay} icon={<Icon size={12} color={color} />} style={style}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
