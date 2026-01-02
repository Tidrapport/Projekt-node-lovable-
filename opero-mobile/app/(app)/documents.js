import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { listDocuments } from "../../src/api/documents";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Documents() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    if (!isAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listDocuments();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Kunde inte hämta dokument");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Dokumentcenter</Text>
        <Text style={styles.muted}>Dokumentcenter är endast tillgängligt för admin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dokumentcenter</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Laddar…</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.name)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.muted}>{Math.round((item.size || 0) / 1024)} KB</Text>
            {item.updated_at ? <Text style={styles.muted}>Uppdaterad: {item.updated_at.slice(0, 10)}</Text> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>Inga dokument.</Text> : null}
      />
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
  muted: {
    color: colors.muted,
  },
  errorText: {
    color: colors.danger,
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
});
