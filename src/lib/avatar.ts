import { Platform } from "react-native";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";

const BUCKET = "avatars";

export type AvatarStage = "preparar" | "enviar" | "salvar";

/** An error that says which step failed and why, in plain language (plus the original message). */
export class AvatarError extends Error {
  constructor(
    public stage: AvatarStage,
    message: string,
  ) {
    super(message);
  }
}

const STAGE_LABEL: Record<AvatarStage, string> = {
  preparar: "ao preparar a imagem",
  enviar: "ao enviar para o Storage",
  salvar: "ao salvar no perfil",
};

/** Maps the raw error from the picker / Storage / database to something a person can act on. */
export function describeAvatarError(stage: AvatarStage, error: unknown): AvatarError {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  console.warn("[avatar]", stage, code, raw);

  let reason = raw;
  if (stage === "enviar") {
    if (/bucket not found/i.test(raw)) reason = 'O bucket "avatars" não existe. Rode a migration 0004 (ou crie um bucket público chamado avatars).';
    else if (/row-level security|unauthorized|forbidden|not allowed|403/i.test(raw))
      reason = "Sem permissão no Storage: as regras (policies) do bucket avatars não existem. Rode a migration 0004.";
    else if (/exceed|too large|maximum allowed size|413/i.test(raw)) reason = "A imagem passou do limite de 1 MB.";
    else if (/mime|not supported|invalid/i.test(raw)) reason = "Formato não aceito. Use JPG, PNG ou WebP.";
    else if (/network request failed|failed to fetch|timeout/i.test(raw)) reason = "Falha de rede durante o envio. Tente de novo com a internet estável.";
  } else if (stage === "salvar") {
    if (/avatar_path|avatar_updated_at|schema cache|does not exist/i.test(raw) || code === "PGRST204" || code === "42703")
      reason = "O perfil ainda não tem as colunas da foto. Rode a migration 0004 no Supabase.";
    else if (code === "23514") reason = "O caminho da foto é inválido (deve ficar na pasta do seu usuário).";
    else if (/permission denied|row-level security/i.test(raw)) reason = "Sem permissão para atualizar o perfil.";
  } else if (stage === "preparar") {
    if (/permission/i.test(raw)) reason = "Sem permissão para acessar suas fotos. Libere nas configurações do celular.";
  }
  const detail = reason !== raw ? ` [detalhe técnico: ${raw.slice(0, 140)}${code ? `, código ${code}` : ""}]` : "";
  return new AvatarError(stage, `Foto não enviada (${STAGE_LABEL[stage]}): ${reason}${detail}`);
}

/** Public URL of a profile photo. `version` (the upload time) busts caches when the photo changes. */
export function avatarUrl(path: string | null | undefined, version?: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}

/** Lets the user pick and crop a square photo, then returns a small (512px) JPEG on disk. null = cancelled. */
export async function pickAvatarFile(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;

  try {
    const image = await ImageManipulator.manipulate(asset.uri).resize({ width: 512 }).renderAsync();
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return out.uri;
  } catch (e) {
    throw describeAvatarError("preparar", e);
  }
}

/** Uploads the photo to <user_id>/avatar.jpg (replacing the previous one) and returns the storage path. */
export async function uploadAvatar(userId: string, fileUri: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  try {
    // fetch(file://).arrayBuffer() returns empty/garbage on React Native, so read the bytes natively.
    const body = Platform.OS === "web" ? await (await fetch(fileUri)).arrayBuffer() : await new File(fileUri).arrayBuffer();
    // A real 512px JPEG is tens of KB. Never upload an (almost) empty file.
    if (body.byteLength < 1024) throw new Error(`o arquivo da imagem veio vazio (${body.byteLength} bytes)`);
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
  } catch (e) {
    throw describeAvatarError("enviar", e);
  }
  return path;
}

export async function removeAvatarFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
