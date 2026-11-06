import { useRef, useState } from "react";
import { View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { H2, Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { invalidateDerived, libraryQuery } from "@/hooks/use-library";
import { parseImport, toInsert, type ImportRow } from "@/lib/import";
import { matchGames } from "@/lib/igdb";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

type Phase =
  | { step: "idle" }
  | { step: "working"; label: string; done: number; total: number }
  | { step: "done"; imported: number; existing: number; invalid: number; notFound: number };

const CHUNK = 100;

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
      const haveIgdb = new Set(current.map((g) => g.igdb_id));
      let rows: ImportRow[] = parsed.rows.filter((r) => r.igdb_id == null || !haveIgdb.has(r.igdb_id));
      let existing = parsed.rows.length - rows.length;

      if (rows.length === 0) {
        setPhase({ step: "done", imported: 0, existing, invalid: parsed.invalid, notFound: 0 });
        return;
      }

      // Old files only know the RAWG id and have no cover: find each game in IGDB by title (20 per request).
      const needLookup = rows.filter((r) => r.igdb_id == null || !r.cover_url);
      let lookupFailed = false;
      for (let i = 0; i < needLookup.length && !lookupFailed; i += 20) {
        const batch = needLookup.slice(i, i + 20);
        setPhase({ step: "working", label: "Procurando os jogos na nova base…", done: i, total: needLookup.length });
        const { results, error } = await matchGames(
          batch.map((r) => ({ name: r.name, year: r.release_year ?? null, platforms: r.platforms ?? [] })),
        );
        if (error) lookupFailed = true; // keep what was matched so far; the rest is reported as not found
        for (const m of results) {
          const row = batch[m.index];
          if (!row || m.status !== "matched" || !m.best) continue;
          if (row.igdb_id == null) row.igdb_id = m.best.id;
          if (row.igdb_id !== m.best.id) continue;
          row.cover_url ??= m.best.cover;
          if (!row.release_year) row.release_year = m.best.year;
          if (!row.genres?.length) row.genres = m.best.genres;
          if (!row.platforms?.length) row.platforms = m.best.platforms;
        }
      }

      // Two file rows (or a row and an existing game) may have resolved to the same IGDB game.
      const seenIgdb = new Set<number>();
      rows = rows.filter((r) => {
        if (r.igdb_id == null) return true;
        if (haveIgdb.has(r.igdb_id) || seenIgdb.has(r.igdb_id)) {
          existing++;
          return false;
        }
        seenIgdb.add(r.igdb_id);
        return true;
      });
      // Games that could not be found in IGDB can't be saved: report them instead of importing broken rows.
      const notFound = rows.filter((r) => r.igdb_id == null).length;
      const importable = rows.filter((r): r is ImportRow & { igdb_id: number } => r.igdb_id != null).map(toInsert);

      let imported = 0;
      setPhase({ step: "working", label: "Salvando na biblioteca…", done: 0, total: importable.length });
      for (let i = 0; i < importable.length; i += CHUNK) {
        const chunk = importable.slice(i, i + CHUNK);
        const { error } = await supabase.from("user_games").insert(chunk);
        if (error) {
          // Chunk failed (e.g. a duplicate slipped in): fall back to one by one so the rest still import.
          for (const row of chunk) {
            const { error: e } = await supabase.from("user_games").insert(row);
            if (!e) imported++;
          }
        } else imported += chunk.length;
        setPhase({ step: "working", label: "Salvando na biblioteca…", done: Math.min(i + CHUNK, importable.length), total: importable.length });
      }

      invalidateDerived(qc);
      setPhase({ step: "done", imported, existing, invalid: parsed.invalid + (importable.length - imported), notFound });
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
              {phase.notFound > 0 && (
                <Text muted>{`${phase.notFound} não foram encontrados na base de jogos e ficaram de fora`}</Text>
              )}
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
