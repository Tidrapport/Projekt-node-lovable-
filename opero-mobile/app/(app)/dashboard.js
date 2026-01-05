import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, Pressable, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { listMyTimeEntries } from "../../src/api/timeEntries";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [latest, setLatest] = useState([]);
  const [weekHours, setWeekHours] = useState(0);
  const [monthHours, setMonthHours] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const monthStart = getMonthStart();
        const data = await listMyTimeEntries({ from: monthStart });
        const arr = Array.isArray(data) ? data : data?.items || [];
        const sorted = [...arr].sort((a, b) => String(b.datum || b.date).localeCompare(String(a.datum || a.date)));
        setLatest(sorted.slice(0, 3));
        const weekStart = getWeekStart();
        const weekTotal = sorted
          .filter((item) => (item.datum || item.date) >= weekStart)
          .reduce((sum, item) => sum + Number(item.timmar || item.total_hours || 0), 0);
        const monthTotal = sorted.reduce((sum, item) => sum + Number(item.timmar || item.total_hours || 0), 0);
        setWeekHours(weekTotal);
        setMonthHours(monthTotal);
      } catch {
        setLatest([]);
        setWeekHours(0);
        setMonthHours(0);
      }
    };
    load();
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.welcomeCard, cardShadow]}>
        <Text style={styles.title}>Välkommen</Text>
        <Text style={styles.name}>{user?.full_name || user?.email}</Text>
        <Text style={styles.meta}>Roll: {user?.role}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, cardShadow]}>
          <Text style={styles.statLabel}>Denna vecka</Text>
          <Text style={styles.statValue}>{weekHours.toFixed(1)} h</Text>
        </View>
        <View style={[styles.statCard, cardShadow]}>
          <Text style={styles.statLabel}>Denna månad</Text>
          <Text style={styles.statValue}>{monthHours.toFixed(1)} h</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/(app)/time-new")}>
          <Text style={styles.primaryButtonText}>Ny tidrapport</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/(app)/deviation-new")}>
          <Text style={styles.secondaryButtonText}>Registrera avvikelse</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/(app)/time")}>
          <Text style={styles.secondaryButtonText}>Se tidrapporter</Text>
        </Pressable>
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Senaste tidrapporter</Text>
        {latest.length === 0 ? (
          <Text style={styles.muted}>Inga tidrapporter ännu.</Text>
        ) : (
          latest.map((item, idx) => (
            <View key={`${item.id ?? idx}`} style={styles.rowItem}>
              <View>
                <Text style={styles.rowTitle}>{item.datum || item.date || "Datum?"}</Text>
                <Text style={styles.muted}>
                  {item.starttid || item.start_time || "Start?"} – {item.sluttid || item.end_time || "Slut?"}
                </Text>
              </View>
              <Text style={styles.rowBadge}>{Number(item.timmar || item.total_hours || 0).toFixed(1)} h</Text>
            </View>
          ))
        )}
      </View>

      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Logga ut</Text>
      </Pressable>
    </ScrollView>
  );
}

const getWeekStart = () => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - day);
  return now.toISOString().slice(0, 10);
};

const getMonthStart = () => {
  const now = new Date();
  now.setDate(1);
  return now.toISOString().slice(0, 10);
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  welcomeCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "700",
  },
  name: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "800",
    marginTop: 4,
  },
  meta: {
    color: "#dbe7ff",
    marginTop: 6,
  },
  actionRow: {
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  statLabel: {
    color: colors.muted,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  rowTitle: {
    fontWeight: "700",
    color: colors.text,
  },
  rowBadge: {
    backgroundColor: colors.navAccent,
    color: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: "hidden",
    fontWeight: "700",
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
