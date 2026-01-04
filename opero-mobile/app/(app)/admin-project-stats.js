import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { listProjects } from "../../src/api/projects";
import { listTimeEntries } from "../../src/api/timeEntries";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function AdminProjectStats() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [projects, setProjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    try {
      const [projData, entryData] = await Promise.all([
        listProjects(),
        listTimeEntries({ limit: 2000 }),
      ]);
      setProjects(Array.isArray(projData) ? projData : []);
      setEntries(Array.isArray(entryData) ? entryData : []);
    } catch (err) {
      setProjects([]);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Compute for each project: active flag and number of distinct users who reported time
  const stats = useMemo(() => {
    const byProj = projects.map((p) => ({ id: String(p.id), name: p.name || p.title || p.project_name || "Projekt", active: !!p.active }));
    const reportersPer = {};
    (entries || []).forEach((e) => {
      const pid = String(e.project_id ?? e.projectId ?? "");
      const uid = String(e.user_id ?? e.userId ?? e.profile_id ?? e.user?.id ?? "");
      if (!pid) return;
      if (!reportersPer[pid]) reportersPer[pid] = new Set();
      if (uid) reportersPer[pid].add(uid);
    });
    return byProj.map((p) => ({ ...p, reporters: reportersPer[p.id] ? reportersPer[p.id].size : 0 }));
  }, [projects, entries]);

  if (!isAdmin) return <View style={styles.container}><Text style={styles.muted}>Endast administratörer kan se denna vy.</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={stats}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={<Text style={styles.title}>Projektstatistik</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.projectName}>{item.name}</Text>
            <Text style={styles.meta}>{item.active ? "Aktiv" : "Inaktiv"} • {item.reporters} rapportörer</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>Inga projekt hittades.</Text> : <Text style={styles.muted}>Laddar…</Text>}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  card: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  projectName: { fontWeight: "800", color: colors.text },
  meta: { color: colors.muted, marginTop: spacing.xs },
  muted: { color: colors.muted },
});
