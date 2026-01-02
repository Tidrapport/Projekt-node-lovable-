import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { login } from "../src/api/endpoints";
import { useAuth } from "../src/auth/AuthProvider";
import { API_BASE_URL } from "../src/config";
import { lightColors, spacing, radius, cardShadow } from "../src/ui/theme";

export default function Login() {
  const { setUser } = useAuth();
  const colors = lightColors;
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

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerGlow} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <WebView
              source={{ uri: `${API_BASE_URL}/rotlogo3d.html` }}
              style={styles.logoWebview}
              originWhitelist={["*"]}
              javaScriptEnabled
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              androidLayerType="hardware"
            />
          </View>

          <Text style={styles.title}>Logga in</Text>
          <Text style={styles.subtitle}>Ange e-post och lösenord för att fortsätta.</Text>

          <View style={[styles.card, cardShadow]}>
            <Text style={styles.label}>E-post</Text>
            <TextInput
              placeholder="exempel@företag.se"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />

            <Text style={styles.label}>Lösenord</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={onLogin}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !busy ? { opacity: 0.85 } : null,
                busy ? { opacity: 0.7 } : null,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Logga in</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0f4a8a",
  },
  headerGlow: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: "rgba(255,255,255,0.25)",
    opacity: 0.2,
    borderBottomLeftRadius: 220,
    borderBottomRightRadius: 220,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  logoWrap: {
    width: 260,
    height: 140,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  logoWebview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
  },
  subtitle: {
    color: "#dbeafe",
    textAlign: "center",
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  primaryButton: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
