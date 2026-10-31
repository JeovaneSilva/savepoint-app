import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AuthRetryableFetchError, AuthWeakPasswordError, type AuthError } from "@supabase/supabase-js";
import { MailCheck } from "lucide-react-native";
import { z } from "zod";
import { Backdrop } from "@/components/Screen";
import { SignedInRedirect } from "@/components/SignedInRedirect";
import { Card, Logo, RawgAttribution } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { H2, Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/use-auth";
import { NICKNAME_HINT, isNicknameAvailable, validateNickname } from "@/lib/nickname";
import { supabase } from "@/lib/supabase";
import { colors, shadowCard } from "@/theme";

const credsSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres").max(72),
});

const WEAK_REASON: Record<string, string> = {
  length: "tamanho mínimo",
  characters: "letras maiúsculas, minúsculas, números e símbolos",
  pwned: "senha já vazada em listas públicas",
};

/** Turns a Supabase auth error into a specific, actionable message (and logs the raw error). */
function describeAuthError(error: AuthError, mode: "login" | "signup"): string {
  console.warn("[auth]", mode, error.name, error.status, error.code, error.message);
  const msg = error.message ?? "";
  const code = error.code ?? "";

  if (error instanceof AuthWeakPasswordError || code === "weak_password") {
    const reasons = error instanceof AuthWeakPasswordError ? error.reasons : [];
    const detail = reasons.map((r) => WEAK_REASON[r] ?? r).join(", ");
    return `Senha fraca${detail ? ` (exigido: ${detail})` : ""}. ${msg}`.trim();
  }
  if (error instanceof AuthRetryableFetchError || /network request failed|failed to fetch/i.test(msg)) {
    return "Sem conexão com o Supabase. Confira a internet e a EXPO_PUBLIC_SUPABASE_URL no .env (reinicie o Expo após mudar).";
  }
  if (/invalid api key|apikey/i.test(msg) || error.status === 401) {
    return "Chave do Supabase inválida. Confira a EXPO_PUBLIC_SUPABASE_KEY no .env (reinicie o Expo após mudar).";
  }
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "Esse email já tem conta. Use a aba Entrar.";
    case "email_not_confirmed":
      return "Confirme seu email antes de entrar (veja a caixa de entrada e o spam).";
    case "invalid_credentials":
      return "Email ou senha incorretos.";
    case "email_address_invalid":
      return "O Supabase recusou esse email. Tente outro endereço.";
    case "signup_disabled":
      return "Cadastros estão desativados no projeto (Authentication → Sign In / Providers).";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas ou emails enviados. Aguarde alguns minutos e tente de novo.";
  }
  if (/already registered/i.test(msg)) return "Esse email já tem conta. Use a aba Entrar.";
  if (/invalid login credentials/i.test(msg)) return "Email ou senha incorretos.";
  if (/not confirmed/i.test(msg)) return "Confirme seu email antes de entrar.";
  return `${mode === "login" ? "Não foi possível entrar" : "Não foi possível criar a conta"}: ${msg || code || "erro desconhecido"}`;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { user } = useAuth();

  async function submit() {
    const parsed = credsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (mode === "signup") {
      const nickError = validateNickname(nickname);
      if (nickError) {
        toast.error(nickError);
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup" && !(await isNicknameAvailable(nickname))) {
        toast.error("Esse apelido já está em uso. Escolha outro.");
        return;
      }
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          toast.error(describeAuthError(error, "login"));
          return;
        }
        toast.success("Bem-vindo de volta, player!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          // A database trigger turns this into the profile (the nickname shown in the ranking).
          options: { data: { nickname: nickname.trim() } },
        });
        if (error) {
          toast.error(describeAuthError(error, "signup"));
          return;
        }
        if (!data.session) setSentTo(parsed.data.email);
      }
    } finally {
      setBusy(false);
    }
  }

  if (user) return <SignedInRedirect />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 400, alignSelf: "center", gap: 32 }}>
            <View style={{ alignItems: "center" }}>
              <Logo size={40} />
            </View>

            {sentTo ? (
              <Card style={{ alignItems: "center", gap: 14, padding: 24, ...shadowCard }}>
                <MailCheck size={40} color={colors.accent} />
                <H2>Confira seu email</H2>
                <Text muted style={{ textAlign: "center", lineHeight: 20 }}>
                  Enviamos um link de confirmação para{" "}
                  <Text weight="semibold">{sentTo}</Text>. Clique nele para ativar sua conta.
                </Text>
                <Button variant="ghost" onPress={() => setSentTo(null)}>
                  Voltar
                </Button>
              </Card>
            ) : (
              <View style={{ gap: 16 }}>
                <Tabs
                  value={mode}
                  onChange={setMode}
                  items={[
                    { value: "login", label: "Entrar" },
                    { value: "signup", label: "Criar conta" },
                  ]}
                />
                <Card style={{ padding: 24, gap: 18, ...shadowCard }}>
                  {mode === "signup" && (
                    <View>
                      <Label>Apelido (aparece no ranking)</Label>
                      <Input
                        value={nickname}
                        onChangeText={setNickname}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                        returnKeyType="next"
                      />
                      <Text muted style={{ fontSize: 12, marginTop: 6 }}>
                        {NICKNAME_HINT}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Label>Email</Label>
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>
                  <View>
                    <Label>Senha</Label>
                    <Input
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      returnKeyType="go"
                      onSubmitEditing={submit}
                    />
                  </View>
                  <Button variant="neon" fullWidth loading={busy} onPress={submit}>
                    {busy ? "Carregando…" : mode === "login" ? "Entrar" : "Criar conta"}
                  </Button>

                  <Text muted style={{ fontSize: 12, textAlign: "center", lineHeight: 17 }}>
                    Novas contas só entram depois de aprovadas pelo administrador.
                  </Text>
                </Card>
              </View>
            )}

            <RawgAttribution />
            <Button variant="ghost" size="sm" onPress={() => router.back()} style={{ alignSelf: "center" }}>
              Voltar ao início
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
