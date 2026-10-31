import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Award,
  BookOpen,
  CalendarCheck,
  Clock,
  Crown,
  Flame,
  Gamepad2,
  Gem,
  Landmark,
  Layers,
  Library,
  Lock,
  Medal,
  Moon,
  Pickaxe,
  Shapes,
  Star,
  Timer,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { Sheet } from "@/components/ui/Sheet";
import { H2, Text } from "@/components/ui/Text";
import { alpha, colors, shadowGlow } from "@/theme";

// Icon names come from the `badges` table (lucide names).
const ICONS: Record<string, LucideIcon> = {
  Award,
  BookOpen,
  CalendarCheck,
  Clock,
  Crown,
  Flame,
  Gamepad2,
  Gem,
  Landmark,
  Layers,
  Library,
  Medal,
  Moon,
  Pickaxe,
  Shapes,
  Star,
  Timer,
  Trophy,
  Zap,
};

const TIER: Record<string, { label: string; color: string }> = {
  bronze: { label: "Bronze", color: "#cd8a4b" },
  prata: { label: "Prata", color: "#c3c7d4" },
  ouro: { label: "Ouro", color: colors.star },
  platina: { label: "Platina", color: colors.accent },
};

export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  /** Set when earned. */
  earned_at?: string | null;
  /** Only for my own badges: progress toward the goal. */
  progress?: number;
  threshold?: number;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/** Badge tile; tap to see what it is for. Locked badges are dimmed and show progress. */
export function BadgeMedal({ badge }: { badge: BadgeInfo }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[badge.icon] ?? Trophy;
  const tier = TIER[badge.tier] ?? TIER["bronze"]!;
  const locked = !badge.earned_at;
  const hasProgress = badge.progress != null && badge.threshold != null;
  const pct = hasProgress ? Math.min(1, (badge.progress as number) / (badge.threshold as number)) : 0;

  const circle = (size: number) => (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: locked ? colors.border : tier.color,
          backgroundColor: locked ? colors.secondary : alpha(tier.color, 0.16),
        },
        !locked && { ...shadowGlow, shadowColor: tier.color, shadowOpacity: 0.4, shadowRadius: 10 },
      ]}
    >
      {locked ? (
        <Lock size={size * 0.36} color={colors.mutedForeground} />
      ) : (
        <Icon size={size * 0.46} color={tier.color} />
      )}
    </View>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${badge.name}, ${locked ? "bloqueado" : "conquistado"}`}
        style={{ width: "31.5%", alignItems: "center", gap: 6, opacity: locked ? 0.7 : 1 }}
      >
        {circle(60)}
        <Text weight="semibold" numberOfLines={2} style={{ fontSize: 12, textAlign: "center", lineHeight: 15 }}>
          {badge.name}
        </Text>
        {locked && hasProgress && (
          <View style={{ width: "80%", gap: 3, alignItems: "center" }}>
            <View style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: colors.secondary, overflow: "hidden" }}>
              <View style={{ height: 4, width: `${Math.round(pct * 100)}%`, backgroundColor: tier.color }} />
            </View>
            <Text muted style={{ fontSize: 10 }}>
              {`${fmtNum(badge.progress as number)}/${fmtNum(badge.threshold as number)}`}
            </Text>
          </View>
        )}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} scroll={false}>
        <View style={{ alignItems: "center", gap: 10 }}>
          {circle(88)}
          <H2 style={{ textAlign: "center" }}>{badge.name}</H2>
          <Text weight="semibold" style={{ color: tier.color, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" }}>
            {tier.label}
          </Text>
          <Text muted style={{ textAlign: "center", lineHeight: 20 }}>
            {badge.description}
          </Text>
          {locked ? (
            hasProgress && (
              <Text style={{ color: colors.accent }}>
                {`Progresso: ${fmtNum(badge.progress as number)} de ${fmtNum(badge.threshold as number)}`}
              </Text>
            )
          ) : (
            badge.earned_at && <Text style={{ color: colors.statusDone }}>{`Conquistado em ${fmtDate(badge.earned_at)}`}</Text>
          )}
        </View>
      </Sheet>
    </>
  );
}
