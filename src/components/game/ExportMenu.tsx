import { useState } from "react";
import { Platform, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Download } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { H2, Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { colors } from "@/theme";
import { toCsv, toExportJson, type UserGame } from "@/lib/games";

async function share(content: string, filename: string, mime: string) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: "Exportar minha lista" });
  } else {
    toast.error("Compartilhamento indisponível neste dispositivo");
  }
}

export function ExportMenu({ games }: { games: UserGame[] }) {
  const [open, setOpen] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  const run = async (kind: "json" | "csv") => {
    setOpen(false);
    try {
      if (kind === "json") await share(toExportJson(games), `savepoint-${stamp}.json`, "application/json");
      else await share("FEFF" + toCsv(games), `savepoint-${stamp}.csv`, "text/csv");
      toast.success(kind === "json" ? "Lista exportada em JSON" : "Lista exportada em CSV");
    } catch {
      toast.error("Não foi possível exportar a lista");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={games.length === 0}
        icon={<Download size={14} color={colors.foreground} />}
        onPress={() => setOpen(true)}
      >
        Exportar
      </Button>
      <Sheet visible={open} onClose={() => setOpen(false)} scroll={false}>
        <H2>Exportar minha lista</H2>
        <Text muted style={{ marginTop: 4, marginBottom: 16 }}>
          Escolha o formato do arquivo.
        </Text>
        <View style={{ gap: 8 }}>
          <Button variant="outline" fullWidth onPress={() => run("json")}>
            JSON
          </Button>
          <Button variant="outline" fullWidth onPress={() => run("csv")}>
            CSV (planilha)
          </Button>
        </View>
      </Sheet>
    </>
  );
}
