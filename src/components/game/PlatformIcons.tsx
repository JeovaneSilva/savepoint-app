import { View } from "react-native";
import { Badge } from "@/components/ui/Badge";
import { PARENT_PLATFORM_SHORT } from "@/lib/games";

export function PlatformIcons({ slugs, max = 5 }: { slugs: string[]; max?: number }) {
  const shown = slugs.slice(0, max);
  const rest = slugs.length - shown.length;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {shown.map((s) => (
        <Badge key={s} variant="platform">
          {PARENT_PLATFORM_SHORT[s] ?? s.slice(0, 4).toUpperCase()}
        </Badge>
      ))}
      {rest > 0 && <Badge variant="platform">{`+${rest}`}</Badge>}
    </View>
  );
}
