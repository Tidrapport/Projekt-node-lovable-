import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { changePassword } from "../../src/api/endpoints";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function ChangePassword() {
  const { colors } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setError(null);
    setMessage(null);
    if (!password || password.length < 6) {
      setError("Lösenord måste vara minst 6 tecken.");
      return;
    }
    if (password !== confirm) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(password);
      setMessage("Lösenord uppdaterat.");
      setPassword("");
      setConfirm("");
    } catch (e) {
      setError(e.message || "Kunde inte uppdatera lösenord.");
    } finally {
      setBusy(false);
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Byt lösenord</Text>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.label}>Nytt lösenord</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        <Text style={styles.label}>Bekräfta lösenord</Text>
        <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry style={styles.input} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={onSave} disabled={busy}>
          <Text style={styles.primaryButtonText}>{busy ? "Sparar…" : "Spara"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  label: {
    fontWeight: "700",
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
  },
  successText: {
    color: colors.success,
  },
});
