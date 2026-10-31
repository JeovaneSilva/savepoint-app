import { Pressable, View } from "react-native";
import { Star } from "lucide-react-native";
import { alpha, colors } from "@/theme";

const SIZE = { sm: 14, md: 20, lg: 30 } as const;

export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: keyof typeof SIZE;
}) {
  const v = value ?? 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: onChange ? 6 : 2 }} accessibilityLabel={`Nota ${v} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= v;
        const star = (
          <Star
            size={SIZE[size]}
            color={filled ? colors.star : alpha(colors.mutedForeground, 0.4)}
            fill={filled ? colors.star : "transparent"}
          />
        );
        if (!onChange) return <View key={n}>{star}</View>;
        return (
          <Pressable
            key={n}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityLabel={`${n} estrela${n > 1 ? "s" : ""}`}
            onPress={() => onChange(v === n ? null : n)}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
