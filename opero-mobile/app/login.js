import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { login } from "../src/api/endpoints";
import { useAuth } from "../src/auth/AuthProvider";

export default function Login() {
  const { refresh, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);

      // ✅ sätt user direkt från login-svaret
      setUser(user);

      router.replace("/(app)/dashboard");
    } catch (e) {
      setError(e?.message || "Login misslyckades");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>Opero</Text>

      <TextInput
        placeholder="E-post"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
      />

      <TextInput
        placeholder="Lösenord"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
      />

      {!!error && <Text style={{ color: "red" }}>{error}</Text>}

      <Pressable
        onPress={onLogin}
        disabled={busy}
        style={{ padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "center", opacity: busy ? 0.7 : 1 }}
      >
        {busy ? <ActivityIndicator /> : <Text style={{ fontWeight: "700" }}>Logga in</Text>}
      </Pressable>
    </View>
  );
}
