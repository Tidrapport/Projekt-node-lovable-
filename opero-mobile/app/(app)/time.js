import { useEffect, useMemo, useState, useCallback } from "react";
import { Alert, View, Text, Pressable, SectionList, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { listMyTimeEntries, deleteTimeEntry } from "../../src/api/timeEntries";
import { subscribe } from "../../src/lib/bus";
import { calculateObDistributionWithOvertime } from "../../src/lib/obDistribution";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Time() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [obSummary, setObSummary] = useState({ day: 0, evening: 0, night: 0, weekend: 0 });
  const [overtimeSummary, setOvertimeSummary] = useState({ weekday: 0, weekend: 0 });
  const [totalHours, setTotalHours] = useState(0);
  const [compSavedHours, setCompSavedHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listMyTimeEntries({ include_materials: true });
      // backend kan returnera array direkt eller {items:[]}
      const arr = Array.isArray(data) ? data : data?.items || [];
      // sortera senaste överst (nyaste date först)
      arr.sort((a, b) =>
        String(b.datum || b.date || b.work_date).localeCompare(String(a.datum || a.date || a.work_date))
      );
      setItems(arr);
      setSections(groupByWeek(arr));
      setObSummary(buildObSummary(arr));
      setOvertimeSummary(buildOvertimeSummary(arr));
      const totals = buildTotals(arr);
      setTotalHours(totals.total);
      setCompSavedHours(totals.compSaved);
    } catch (e) {
      setError(e.message || "Kunde inte hämta tidrapporter");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribe((e) => {
      if (e === "timeEntries:changed") load();
    });
    return unsub;
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Översikt tidrapporter</Text>
          <Text style={styles.subtitle}>Se och skapa dina tidrapporter.</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/(app)/time-new")}>
          <Text style={styles.primaryButtonText}>Ny tid</Text>
        </Pressable>
      </View>

      <View style={styles.obRow}>
        {[
          { label: "Totaltimmar", value: Math.max(0, totalHours - compSavedHours) },
          { label: "Kväll", value: obSummary.evening },
          { label: "Natt", value: obSummary.night },
          { label: "Helg", value: obSummary.weekend },
          { label: "ÖT vardag", value: overtimeSummary.weekday },
          { label: "ÖT helg", value: overtimeSummary.weekend },
          { label: "Sparad komp", value: compSavedHours },
        ].map((item) => (
          <View key={item.label} style={styles.obChip}>
            <Text style={styles.obLabel}>{item.label}</Text>
            <Text style={styles.obValue}>{item.value.toFixed(1)} h</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Laddar…</Text> : null}

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const status = item.status || "Ny";
          const isAttested = status === "Attesterad";
          const canModify = isAdmin || !isAttested;

          return (
            <View style={[styles.card, cardShadow]}>
              <View style={styles.rowTop}>
                <Text style={styles.cardTitle}>
                  {formatDayLabel(item.datum || item.date || item.work_date)}
                </Text>
                <View style={styles.badgeRow}>
                  {isAttested ? <Text style={styles.attestedBadge}>Attesterad</Text> : null}
                  <Text style={styles.hoursBadge}>
                    {Number(item.timmar || item.total_hours || 0).toFixed(1)} h
                  </Text>
                </View>
              </View>
              <Text style={styles.muted}>
                {item.starttid || item.start_time || item.start || "Start?"} – {item.sluttid || item.end_time || item.end || "Slut?"}
              </Text>
              {item.comment ? <Text style={styles.comment}>📝 {item.comment}</Text> : null}
              {item.project_name ? <Text style={styles.muted}>Projekt: {item.project_name}</Text> : null}

              {canModify ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.outlineButton}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/time-new",
                        params: { id: String(item.id) },
                      })
                    }
                  >
                    <Text style={styles.outlineText}>Ändra</Text>
                  </Pressable>
                  <Pressable
                    style={styles.dangerButton}
                    onPress={() =>
                      Alert.alert(
                        "Ta bort tidrapport",
                        "Vill du verkligen ta bort denna tidrapport?",
                        [
                          { text: "Avbryt", style: "cancel" },
                          {
                            text: "Ta bort",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await deleteTimeEntry(item.id);
                                load();
                              } catch (e) {
                                setError(e.message || "Kunde inte ta bort tidrapport");
                              }
                            },
                          },
                        ]
                      )
                    }
                  >
                    <Text style={styles.dangerText}>Ta bort</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? <Text style={styles.muted}>Inga tidrapporter ännu. Tryck “Ny tid”.</Text> : null
        }
      />
    </View>
  );
}

const formatDayLabel = (dateStr) => {
  if (!dateStr) return "Datum?";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const days = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
  const day = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day} ${dayNum}/${month}`;
};

const getWeekKey = (dateStr) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: tmp.getUTCFullYear() };
};

const groupByWeek = (entries) => {
  const map = new Map();
  entries.forEach((entry) => {
    const key = getWeekKey(entry.datum || entry.date || entry.work_date);
    if (!key) return;
    const label = `v ${key.week} · ${key.year}`;
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(entry);
  });
  return Array.from(map.entries()).map(([title, data]) => ({
    title,
    data: data.sort((a, b) =>
      String(b.datum || b.date || b.work_date).localeCompare(String(a.datum || a.date || a.work_date))
    ),
  }));
};

const buildObSummary = (entries) => {
  return entries.reduce(
    (acc, entry) => {
      const date = entry.datum || entry.date || entry.work_date;
      const start = entry.starttid || entry.start_time || entry.start;
      const end = entry.sluttid || entry.end_time || entry.end;
      const baseDist = calculateObDistributionWithOvertime(date, start, end, 0, 0, 0);
      const adjusted = applyOvertimeToOb(
        baseDist,
        entry.overtime_weekday_hours,
        entry.overtime_weekend_hours
      );
      acc.day += adjusted.day;
      acc.evening += adjusted.evening;
      acc.night += adjusted.night;
      acc.weekend += adjusted.weekend;
      return acc;
    },
    { day: 0, evening: 0, night: 0, weekend: 0 }
  );
};

const buildOvertimeSummary = (entries) => {
  return entries.reduce(
    (acc, entry) => {
      acc.weekday += Number(entry.overtime_weekday_hours || 0);
      acc.weekend += Number(entry.overtime_weekend_hours || 0);
      return acc;
    },
    { weekday: 0, weekend: 0 }
  );
};

const buildTotals = (entries) => {
  return entries.reduce(
    (acc, entry) => {
      acc.total += Number(entry.timmar || entry.total_hours || 0);
      acc.compSaved += getCompSaved(entry);
      return acc;
    },
    { total: 0, compSaved: 0 }
  );
};

const getCompSaved = (entry) => {
  const direct = Number(entry.comp_time_saved_hours || 0);
  if (direct > 0) return direct;
  if (entry.save_comp_time) {
    return Number(entry.overtime_weekday_hours || 0) + Number(entry.overtime_weekend_hours || 0);
  }
  return 0;
};

const applyOvertimeToOb = (dist, overtimeWeekdayHours, overtimeWeekendHours) => {
  let day = Number(dist.day || 0);
  let evening = Number(dist.evening || 0);
  let night = Number(dist.night || 0);
  let weekend = Number(dist.weekend || 0);

  let remainingWeekend = Math.max(0, Number(overtimeWeekendHours || 0));
  if (remainingWeekend > 0) {
    const used = Math.min(weekend, remainingWeekend);
    weekend -= used;
    remainingWeekend -= used;
  }

  let remainingWeekday = Math.max(0, Number(overtimeWeekdayHours || 0));
  if (remainingWeekday > 0) {
    const nightUsed = Math.min(night, remainingWeekday);
    night -= nightUsed;
    remainingWeekday -= nightUsed;

    const eveningUsed = Math.min(evening, remainingWeekday);
    evening -= eveningUsed;
    remainingWeekday -= eveningUsed;

    const dayUsed = Math.min(day, remainingWeekday);
    day -= dayUsed;
  }

  return { day, evening, night, weekend };
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  obRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  obChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: "22%",
    alignItems: "center",
    gap: 2,
  },
  obLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  obValue: {
    fontWeight: "800",
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
  },
  muted: {
    color: colors.muted,
  },
  sectionHeader: {
    color: colors.primary,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  hoursBadge: {
    backgroundColor: colors.navAccent,
    color: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: "hidden",
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  attestedBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    color: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    fontWeight: "700",
    overflow: "hidden",
  },
  comment: {
    color: colors.text,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  outlineText: {
    fontWeight: "700",
    color: colors.text,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  dangerText: {
    fontWeight: "700",
    color: colors.danger,
  },
});
