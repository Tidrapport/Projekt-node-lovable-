import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { listContacts } from "../../src/api/contacts";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Contacts() {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const data = await listContacts();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Kunde inte hämta kontakter");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kontakter</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Laddar…</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.cardTitle}>{item.full_name || item.email}</Text>
            <Text style={styles.muted}>{item.phone || "Inget nummer"}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>Inga kontakter.</Text> : null}
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
