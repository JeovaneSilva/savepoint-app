import { supabase } from "./supabase";

// Keep in sync with profiles_nickname_format in supabase/migrations/0002_profiles_ranking.sql.
const NICKNAME_RE = /^[\w.-]{3,20}$/;

export const NICKNAME_HINT = "3 a 20 caracteres: letras, números, ponto, hífen ou _ (sem espaços).";

/** Returns an error message, or null when the nickname is valid. */
export function validateNickname(value: string): string | null {
  const v = value.trim();
  if (!v) return "Escolha um apelido";
  return NICKNAME_RE.test(v) ? null : `Apelido inválido. Use ${NICKNAME_HINT}`;
}

/** Asks the server if the nickname is free. If the check itself fails we don't block the user. */
export async function isNicknameAvailable(value: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("nickname_available", { p_nickname: value.trim() });
  if (error) {
    console.warn("[nickname] availability check failed", error.message);
    return true;
  }
  return data !== false;
}
