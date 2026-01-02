import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Guides() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guider</Text>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.cardTitle}>Tidrapportering</Text>
        <Text style={styles.muted}>
          Registrera tid med datum, start/slut, rast och projekt. Lägg till övertid och tillägg om det behövs.
        </Text>
      </View>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.cardTitle}>Attestering</Text>
        <Text style={styles.muted}>
          Admin kan attestera nya rapporter under Admin. Attesterade rapporter låses för ändring.
        </Text>
      </View>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.cardTitle}>Projekt & dokument</Text>
        <Text style={styles.muted}>
          Projekt skapas av admin. Dokumentcenter visar TDOK/övriga filer för admin.
        </Text>
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
    gap: spacing.xs,
  },
  cardTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
});
