import { useRef, useState } from "react";
import { View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { H2, Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { libraryQuery } from "@/hooks/use-library";
import { parseImport, type ImportRow } from "@/lib/import";
import { getGameCover } from "@/lib/rawg";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

type Phase =
  | { step: "idle" }
  | { step: "working"; label: string; done: number; total: number }
  | { step: "done"; imported: number; existing: number; invalid: number; noCover: number };

const CONCURRENCY = 4;
const CHUNK = 100;

/** Runs `fn` over `items` with a small concurrency limit, reporting progress. */
async function pool<T>(items: T[], fn: (item: T) => Promise<void>, onProgress: (done: number) => void) {
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++] as T;
        await fn(item);
        onProgress(++done);
      }
    }),
  );
}

export function ImportButton({ variant = "outline" }: { variant?: "outline" | "neon" }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const busy = useRef(false);

  const close = () => {
    if (phase.step !== "working") setPhase({ step: "idle" });
  };

  async function start() {
    if (busy.current) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/csv", "text/comma-separated-values", "text/plain", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;

    busy.current = true;
    try {
      setPhase({ step: "working", label: "Lendo o arquivo…", done: 0, total: 0 });
      let parsed;
      try {
        parsed = parseImport(await (await fetch(asset.uri)).text());
      } catch {
        setPhase({ step: "idle" });
        toast.error("Arquivo inválido. Use o JSON ou CSV exportado pelo app.");
        return;
      }

      // Skip games that are already in this account's library.
      const current = await qc.fetchQuery({ ...libraryQuery, staleTime: 0 });
      const have = new Set(current.map((g) => g.rawg_id));
      const rows: ImportRow[] = parsed.rows.filter((r) => !have.has(r.rawg_id));
      const existing = parsed.rows.length - rows.length;

      if (rows.length === 0) {
        setPhase({ step: "done", imported: 0, existing, invalid: parsed.invalid, noCover: 0 });
        return;
      }

      // The export has no cover URLs: fetch them from RAWG by id.
      let noCover = 0;
      setPhase({ step: "working", label: "Buscando capas…", done: 0, total: rows.length });
      await pool(
        rows,
        async (row) => {
          const game = await getGameCover(row.rawg_id);
          if (game?.cover) {
            row.cover_url = game.cover;
            if (!row.release_year) row.release_year = game.year;
            if (!row.genres?.length) row.genres = game.genres;
            if (!row.platforms?.length) row.platforms = game.platforms;
          } else noCover++;
        },
        (done) => setPhase({ step: "working", label: "Buscando capas…", done, total: rows.length }),
      );

      let imported = 0;
      setPhase({ step: "working", label: "Salvando na biblioteca…", done: 0, total: rows.length });
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("user_games").insert(chunk);
        if (error) {
          // Chunk failed (e.g. a duplicate slipped in): fall back to one by one so the rest still import.
          for (const row of chunk) {
            const { error: e } = await supabase.from("user_games").insert(row);
            if (!e) imported++;
          }
        } else imported += chunk.length;
        setPhase({ step: "working", label: "Salvando na biblioteca…", done: Math.min(i + CHUNK, rows.length), total: rows.length });
      }

      await qc.invalidateQueries({ queryKey: ["library"] });
      setPhase({ step: "done", imported, existing, invalid: parsed.invalid + (rows.length - imported), noCover });
    } catch {
      setPhase({ step: "idle" });
      toast.error("Não foi possível importar a lista");
    } finally {
      busy.current = false;
    }
  }

  const pct = phase.step === "working" && phase.total > 0 ? phase.done / phase.total : 0;

  return (
    <>
      <Button
        variant={variant}
        size={variant === "neon" ? "default" : "sm"}
        icon={<Upload size={14} color={variant === "neon" ? colors.primaryForeground : colors.foreground} />}
        onPress={start}
      >
        Importar
      </Button>

      <Sheet visible={phase.step !== "idle"} onClose={close} scroll={false}>
        {phase.step === "working" && (
          <View style={{ gap: 14 }}>
            <H2>Importando sua lista</H2>
            <Text muted>{phase.label}</Text>
            <View style={{ height: 8, borderRadius: radius.sm, backgroundColor: colors.secondary, overflow: "hidden" }}>
              <View
                style={{
                  height: 8,
                  width: phase.total > 0 ? `${Math.round(pct * 100)}%` : "8%",
                  backgroundColor: colors.primary,
                }}
              />
            </View>
            {phase.total > 0 && (
              <Text muted style={{ fontSize: 12 }}>{`${phase.done} de ${phase.total}`}</Text>
            )}
            <Text muted style={{ fontSize: 12 }}>
              Mantenha o app aberto até terminar.
            </Text>
          </View>
        )}

        {phase.step === "done" && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={24} color={colors.statusDone} />
              <H2>{phase.imported > 0 ? "Importação concluída" : "Nada novo para importar"}</H2>
            </View>
            <View style={{ gap: 4 }}>
              <Text>{`${phase.imported} ${phase.imported === 1 ? "jogo importado" : "jogos importados"}`}</Text>
              {phase.existing > 0 && (
                <Text muted>{`${phase.existing} já estavam na sua biblioteca`}</Text>
              )}
              {phase.invalid > 0 && <Text muted>{`${phase.invalid} não puderam ser lidos`}</Text>}
              {phase.noCover > 0 && <Text muted>{`${phase.noCover} sem capa (RAWG não respondeu)`}</Text>}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
              <Button variant="neon" onPress={close}>
                Fechar
              </Button>
            </View>
          </View>
        )}
      </Sheet>
    </>
  );
}
