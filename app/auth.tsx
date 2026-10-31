import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { z } from "zod";
import { Backdrop } from "@/components/Screen";
import { Card, Logo, RawgAttribution } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { H2, Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { colors, shadowCard } from "@/theme";

const credsSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres").max(72),
});

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  async function submit() {
    const parsed = credsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          toast.error(
            error.message.includes("Email not confirmed") ? "Confirme seu email antes de entrar" : "Email ou senha incorretos",
          );
          return;
        }
        toast.success("Bem-vindo de volta, player!");
      } else {
        const { data, error } = await supabase.auth.signUp(parsed.data);
        if (error) {
          toast.error(error.message.includes("registered") ? "Esse email já tem conta" : "Não foi possível criar a conta");
          return;
        }
        if (!data.session) setSentTo(parsed.data.email);
      }
    } finally {
      setBusy(false);
    }
  }

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
