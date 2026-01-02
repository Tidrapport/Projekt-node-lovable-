import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.label}>Namn</Text>
        <Text style={styles.value}>{user?.full_name || "-"}</Text>
        <Text style={styles.label}>E-post</Text>
        <Text style={styles.value}>{user?.email || "-"}</Text>
        <Text style={styles.label}>Roll</Text>
        <Text style={styles.value}>{user?.role || "-"}</Text>
      </View>

      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Logga ut</Text>
      </Pressable>
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
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  value: {
    color: colors.text,
    fontWeight: "600",
  },
  logoutButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
