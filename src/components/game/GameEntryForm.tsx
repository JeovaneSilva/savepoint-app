import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { StarRating } from "./StarRating";
import { colors, radius } from "@/theme";
import { STATUSES, STATUS_LABEL, type GameStatus } from "@/lib/games";

export interface EntryValues {
  status: GameStatus;
  played_on: string | null;
  rating: number | null;
  completed_at: string | null;
  notes: string | null;
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** Which fields make sense for each status (you can't rate a game you haven't played yet). */
export function fieldsFor(status: GameStatus) {
  return {
    platform: status !== "quero_jogar",
    rating: status === "concluido" || status === "abandonado",
    completedAt: status === "concluido",
  };
}

const PLATFORM_LABEL: Record<GameStatus, string> = {
  quero_jogar: "Plataforma",
  jogando: "Plataforma em que estou jogando",
  concluido: "Plataforma em que joguei",
  abandonado: "Plataforma em que joguei",
};

const NOTES_PLACEHOLDER: Record<GameStatus, string> = {
  quero_jogar: "Por que quer jogar? Quem indicou? Onde pretende jogar…",
  jogando: "Em que parte está, impressões até agora…",
  concluido: "Memórias, dicas, com quem jogou…",
  abandonado: "Por que parou? Onde travou…",
};

/** Clears the values that don't apply to the chosen status, so the saved data stays consistent. */
export function normalizeEntry(v: EntryValues): EntryValues {
  const f = fieldsFor(v.status);
  return {
    status: v.status,
    played_on: f.platform ? v.played_on || null : null,
    rating: f.rating ? v.rating : null,
    completed_at: f.completedAt ? v.completed_at || null : null,
    notes: v.notes?.trim() ? v.notes.trim() : null,
  };
}

const toDate = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`) : new Date());
const toISO = (d: Date) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");

function DateField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  if (Platform.OS === "web") {
    return <Input value={value ?? ""} onChangeText={(t) => onChange(t || null)} placeholder="AAAA-MM-DD" />;
  }
  if (Platform.OS === "ios") {
    return (
      <View style={{ alignItems: "flex-start" }}>
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display="compact"
          maximumDate={new Date()}
          themeVariant="dark"
          accentColor={colors.primary}
          onChange={(_, d) => d && onChange(toISO(d))}
        />
      </View>
    );
  }
  return (
    <Pressable
      onPress={() =>
        DateTimePickerAndroid.open({
          value: toDate(value),
          mode: "date",
          maximumDate: new Date(),
          onChange: (_, d) => d && onChange(toISO(d)),
        })
      }
      style={{
        height: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: 12,
      }}
    >
      <CalendarDays size={16} color={colors.mutedForeground} />
      <Text style={{ color: value ? colors.foreground : colors.mutedForeground }}>
        {value ? br(value) : "Escolha a data"}
      </Text>
    </Pressable>
  );
}

interface Props {
  initial: EntryValues;
  platforms: string[];
  submitLabel: string;
  pending?: boolean;
  onSubmit: (v: EntryValues) => void;
  onCancel?: () => void;
}

export function GameEntryForm({ initial, platforms, submitLabel, pending, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<EntryValues>(initial);
  const set = <K extends keyof EntryValues>(k: K, val: EntryValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const show = fieldsFor(v.status);
  const platformOptions = Array.from(new Set([...(v.played_on ? [v.played_on] : []), ...platforms]));

  return (
    <View style={{ gap: 18 }}>
      <View>
        <Label>Status</Label>
        <Select
          title="Status"
          value={v.status}
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          onChange={(s) => {
            const status = s as GameStatus;
            setV((p) => ({
              ...p,
              status,
              completed_at: status === "concluido" ? (p.completed_at ?? todayISO()) : p.completed_at,
              played_on: p.played_on ?? (status !== "quero_jogar" && platforms.length === 1 ? (platforms[0] ?? null) : null),
            }));
          }}
        />
      </View>

      {show.platform && (
        <View>
          <Label>{PLATFORM_LABEL[v.status]}</Label>
          {platformOptions.length > 0 ? (
            <Select
              title={PLATFORM_LABEL[v.status]}
              value={v.played_on}
              placeholder="Escolha a plataforma"
              options={platformOptions.map((p) => ({ value: p, label: p }))}
              onChange={(p) => set("played_on", p || null)}
            />
          ) : (
            <Input value={v.played_on ?? ""} onChangeText={(t) => set("played_on", t || null)} placeholder="Ex.: SNES" />
          )}
        </View>
      )}

      {show.rating && (
        <View>
          <Label>Minha nota</Label>
          <StarRating value={v.rating} onChange={(r) => set("rating", r)} size="lg" />
        </View>
      )}

      {show.completedAt && (
        <View>
          <Label>Data de conclusão</Label>
          <DateField value={v.completed_at} onChange={(d) => set("completed_at", d)} />
        </View>
      )}

      <View>
        <Label>Anotações</Label>
        <Input
          multiline
          height={88}
          maxLength={2000}
          value={v.notes ?? ""}
          onChangeText={(t) => set("notes", t)}
          placeholder={NOTES_PLACEHOLDER[v.status]}
        />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          variant="neon"
          loading={pending}
          onPress={() => onSubmit(normalizeEntry(v))}
        >
          {pending ? "Salvando…" : submitLabel}
        </Button>
      </View>
    </View>
  );
}
