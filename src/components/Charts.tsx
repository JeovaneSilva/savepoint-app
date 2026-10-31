import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { Text } from "@/components/ui/Text";
import { colors, fonts } from "@/theme";

/** Vertical bar chart (games completed per year). */
export function YearBars({ data }: { data: { year: number; count: number }[] }) {
  const [w, setW] = useState(0);
  const h = 220;
  const pad = { top: 16, bottom: 28, left: 28, right: 8 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));
  const innerW = Math.max(0, w - pad.left - pad.right);
  const innerH = h - pad.top - pad.bottom;
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.min(48, slot * 0.7);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }}>
      {w > 0 && (
        <Svg width={w} height={h}>
          {ticks.map((t) => {
            const y = pad.top + innerH - (t / max) * innerH;
            return (
              <G key={t}>
                <Line x1={pad.left} x2={w - pad.right} y1={y} y2={y} stroke={colors.border} strokeDasharray="3 3" />
                <SvgText x={pad.left - 8} y={y + 4} fontSize={12} fill={colors.mutedForeground} textAnchor="end" fontFamily={fonts.regular}>
                  {String(t)}
                </SvgText>
              </G>
            );
          })}
          {data.map((d, i) => {
            const bh = (d.count / max) * innerH;
            const x = pad.left + slot * i + (slot - barW) / 2;
            return (
              <G key={d.year}>
                <Rect x={x} y={pad.top + innerH - bh} width={barW} height={bh} rx={6} fill={colors.chart[0]} />
                <SvgText x={x + barW / 2} y={h - 8} fontSize={12} fill={colors.mutedForeground} textAnchor="middle" fontFamily={fonts.regular}>
                  {String(d.year)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Donut chart with a legend (games per platform). */
export function Donut({ data }: { data: { name: string; count: number }[] }) {
  const size = 200;
  const stroke = 36;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  let offset = 0;

  return (
    <View style={{ alignItems: "center", gap: 16 }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {data.map((d, i) => {
            const len = (d.count / total) * c;
            const gap = data.length > 1 ? 3 : 0;
            const el = (
              <Circle
                key={d.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colors.chart[i % colors.chart.length]}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      <View style={{ width: "100%", gap: 6 }}>
        {data.map((p, i) => (
          <View key={p.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.chart[i % colors.chart.length] }} />
            <Text numberOfLines={1} style={{ flex: 1 }}>
              {p.name}
            </Text>
            <Text weight="semibold">{String(p.count)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars (games per genre). */
export function HBars({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <View key={d.name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text muted numberOfLines={1} style={{ width: 96, fontSize: 12 }}>
            {d.name}
          </Text>
          <View style={{ flex: 1, height: 20, justifyContent: "center" }}>
            <View style={{ width: `${(d.count / max) * 100}%`, height: 20, borderRadius: 6, backgroundColor: colors.chart[1] }} />
          </View>
          <Text weight="semibold" style={{ width: 24, textAlign: "right", fontSize: 12 }}>
            {String(d.count)}
          </Text>
        </View>
      ))}
    </View>
  );
}
