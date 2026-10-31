import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays, Check } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { StarRating } from "./StarRating";
import { alpha, colors, radius } from "@/theme";
import { STATUSES, STATUS_LABEL, type GameStatus } from "@/lib/games";

export interface EntryValues {
  status: GameStatus;
  played_on: string | null;
  rating: number | null;
  completed_at: string | null;
  /** "I don't remember when I finished it" (old games): no date, but still counts as completed. */
  completed_date_unknown: boolean;
  /** Optional: hours it took to finish. */
  hours_played: number | null;
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
    hours: status === "concluido",
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
    // Either a date or "unknown", never both.
    completed_at: f.completedAt && !v.completed_date_unknown ? v.completed_at || null : null,
    completed_date_unknown: f.completedAt && v.completed_date_unknown,
    hours_played: f.hours ? v.hours_played : null,
    notes: v.notes?.trim() ? v.notes.trim() : null,
  };
}

/** "12", "12,5" or "12.5" -> number; empty -> null; anything else -> undefined (invalid). */
export function parseHours(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,5}(\.\d)?$/.test(t)) return undefined;
  return Number(t);
}

const hoursToText = (h: number | null | undefined) => (h == null ? "" : String(h).replace(".", ","));

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
  const [hoursText, setHoursText] = useState(hoursToText(initial.hours_played));
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
        <View style={{ gap: 12 }}>
          <View>
            <Label>Data de conclusão</Label>
            {v.completed_date_unknown ? (
              <Text muted>Sem data: o jogo conta como zerado, mas não entra no ranking do ano.</Text>
            ) : (
              <DateField value={v.completed_at} onChange={(d) => set("completed_at", d)} />
            )}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: v.completed_date_unknown }}
            onPress={() =>
              setV((p) => ({
                ...p,
                completed_date_unknown: !p.completed_date_unknown,
                // Coming back from "unknown": suggest today so the date field isn't empty.
                completed_at: p.completed_date_unknown ? (p.completed_at ?? todayISO()) : null,
              }))
            }
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: v.completed_date_unknown ? colors.primary : colors.border,
                backgroundColor: v.completed_date_unknown ? colors.primary : alpha(colors.card, 0.4),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {v.completed_date_unknown && <Check size={14} color={colors.primaryForeground} />}
            </View>
            <Text>Não lembro quando zerei</Text>
          </Pressable>
        </View>
      )}

      {show.hours && (
        <View>
          <Label>Horas para zerar (opcional)</Label>
          <Input
            value={hoursText}
            onChangeText={setHoursText}
            keyboardType="decimal-pad"
            maxLength={7}
            placeholder="Ex.: 25 ou 12,5"
          />
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
          onPress={() => {
            const hours = show.hours ? parseHours(hoursText) : null;
            if (hours === undefined) {
              toast.error("Horas inválidas. Use um número, como 25 ou 12,5.");
              return;
            }
            onSubmit(normalizeEntry({ ...v, hours_played: hours }));
          }}
        >
          {pending ? "Salvando…" : submitLabel}
        </Button>
      </View>
    </View>
  );
}
