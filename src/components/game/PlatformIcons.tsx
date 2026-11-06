import { View } from "react-native";
import { Badge } from "@/components/ui/Badge";

export function PlatformIcons({ slugs, max = 5 }: { slugs: string[]; max?: number }) {
  const shown = slugs.slice(0, max);
  const rest = slugs.length - shown.length;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {shown.map((s) => (
        <Badge key={s} variant="platform">
          {s.length > 6 ? s.slice(0, 6) : s}
        </Badge>
      ))}
      {rest > 0 && <Badge variant="platform">{`+${rest}`}</Badge>}
    </View>
  );
}
