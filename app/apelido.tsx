import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { UserRound } from "lucide-react-native";
import { Backdrop } from "@/components/Screen";
import { Card, Logo } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { H2, Text } from "@/components/ui/Text";
import { useProfile, useSaveNickname } from "@/hooks/use-profile";
import { NICKNAME_HINT } from "@/lib/nickname";
import { colors, shadowCard } from "@/theme";

/** Pick (first login of older accounts) or change the nickname shown in the ranking. */
export default function NicknameScreen() {
  const { data: profile } = useProfile();
  const save = useSaveNickname();
  const editing = !!profile;
  const [value, setValue] = useState(profile?.nickname ?? "");

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/biblioteca"));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 400, alignSelf: "center", gap: 28 }}>
            <View style={{ alignItems: "center" }}>
              <Logo size={36} />
            </View>
            <Card style={{ padding: 24, gap: 18, ...shadowCard }}>
              <View style={{ alignItems: "center", gap: 10 }}>
                <UserRound size={36} color={colors.accent} />
                <H2>{editing ? "Alterar apelido" : "Escolha seu apelido"}</H2>
                <Text muted style={{ textAlign: "center", lineHeight: 20 }}>
                  É o nome que seus amigos veem no ranking. Seu email nunca aparece.
                </Text>
              </View>
              <View>
                <Label>Apelido</Label>
                <Input
                  value={value}
                  onChangeText={setValue}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={() => save.mutate(value, { onSuccess: leave })}
                />
                <Text muted style={{ fontSize: 12, marginTop: 6 }}>
                  {NICKNAME_HINT}
                </Text>
              </View>
              <Button variant="neon" fullWidth loading={save.isPending} onPress={() => save.mutate(value, { onSuccess: leave })}>
                Salvar
              </Button>
              {editing && (
                <Button variant="ghost" fullWidth onPress={leave}>
                  Cancelar
                </Button>
              )}
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
