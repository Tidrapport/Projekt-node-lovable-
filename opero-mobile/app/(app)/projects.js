import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, RefreshControl, Modal, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { listProjects, createProject } from "../../src/api/projects";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Projects() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const load = async () => {
    setError(null);
    try {
      const data = await listProjects();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Kunde inte hämta projekt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createParam = Array.isArray(params?.create) ? params.create[0] : params?.create;
  useEffect(() => {
    if (createParam === "1" && isAdmin) {
      setCreateOpen(true);
    }
  }, [createParam, isAdmin]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const submitCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Projektnamn krävs.");
      return;
    }
    try {
      await createProject({ name: name.trim(), code: code.trim() || null });
      setName("");
      setCode("");
      setCreateOpen(false);
      if (createParam === "1") {
        router.replace("/(app)/projects");
      }
      load();
    } catch (e) {
      setError(e.message || "Kunde inte skapa projekt");
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Projekt</Text>
        {isAdmin ? (
          <Pressable style={styles.primaryButton} onPress={() => setCreateOpen(true)}>
            <Text style={styles.primaryButtonText}>Nytt projekt</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Laddar…</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.code ? <Text style={styles.muted}>Kod: {item.code}</Text> : null}
            {item.customer_name ? <Text style={styles.muted}>Kund: {item.customer_name}</Text> : null}
            {Number(item.is_active) === 0 ? <Text style={styles.inactive}>Avslutat</Text> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>Inga projekt.</Text> : null}
      />

      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Nytt projekt</Text>
            <Text style={styles.label}>Namn</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} />
            <Text style={styles.label}>Kod (valfritt)</Text>
            <TextInput value={code} onChangeText={setCode} style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.outlineButton}
                onPress={() => {
                  setCreateOpen(false);
                  if (createParam === "1") {
                    router.replace("/(app)/projects");
                  }
                }}
              >
                <Text style={styles.outlineText}>Avbryt</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitCreate}>
                <Text style={styles.primaryButtonText}>Spara</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
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
  errorText: {
    color: colors.danger,
  },
  muted: {
    color: colors.muted,
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
  inactive: {
    color: colors.danger,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  outlineText: {
    fontWeight: "700",
    color: colors.text,
  },
});
