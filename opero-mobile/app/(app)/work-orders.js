import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, RefreshControl, Modal, TextInput, StyleSheet, Alert } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { listAssignedWorkOrders, listWorkOrders, createWorkOrder, startWorkOrder, pauseWorkOrder, closeWorkOrder } from "../../src/api/workOrders";
import { listProjects } from "../../src/api/projects";
import { updateWorkOrder, deleteWorkOrder } from "../../src/api/workOrders";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function WorkOrders() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [filterType, setFilterType] = useState("active"); // active | inactive | all
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState("");

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const data = isAdmin ? await listWorkOrders() : await listAssignedWorkOrders();
        const arr = Array.isArray(data) ? data : [];
        // Defensive client-side filter: ensure non-admins only see orders
        // explicitly assigned to them in case backend returns extra rows.
        const filtered = isAdmin
          ? arr
          : arr.filter((it) => {
              const uid = String(user?.id || user?.user_id || user?.uid || "");
              const assigned = String(it.assigned_user_id ?? it.assigned_to ?? it.assignee_id ?? it.user_id ?? "");
              return assigned && assigned === uid;
            });
        setItems(filtered);
      } catch (e) {
        setError(e.message || "Kunde inte hämta arbetsorder");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = isAdmin ? await listWorkOrders() : await listAssignedWorkOrders();
      const arr = Array.isArray(data) ? data : [];
      const filtered = isAdmin
        ? arr
        : arr.filter((it) => {
            const uid = String(user?.id || user?.user_id || user?.uid || "");
            const assigned = String(it.assigned_user_id ?? it.assigned_to ?? it.assignee_id ?? it.user_id ?? "");
            return assigned && assigned === uid;
          });
      setItems(filtered);
    } catch (e) {
      setError(e.message || "Kunde inte hämta arbetsorder");
    } finally {
      setRefreshing(false);
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
    setEditProjectId(item.project_id ? String(item.project_id) : "");
    // Ensure we have project list available for picker
    (async () => {
      try {
        const data = await listProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch {
        setProjects([]);
      }
    })();
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editingItem) return;
    try {
      await updateWorkOrder(editingItem.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        project_id: editProjectId || null,
      });
      setEditOpen(false);
      setEditingItem(null);
      refresh();
    } catch (e) {
      setError(e.message || "Kunde inte uppdatera arbetsorder");
    }
  };

  const confirmDelete = (item) => {
    Alert.alert("Ta bort arbetsorder", "Är du säker på att du vill ta bort denna arbetsorder? Detta går inte att ångra.", [
      { text: "Avbryt", style: "cancel" },
      { text: "Ta bort", style: "destructive", onPress: () => doDelete(item) },
    ]);
  };

  const doDelete = async (item) => {
    try {
      await deleteWorkOrder(item.id);
      refresh();
    } catch (e) {
      setError(e.message || "Kunde inte radera arbetsorder");
    }
  };

  const openCreate = async () => {
    try {
      const data = await listProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    }
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setError(null);
    try {
      await createWorkOrder({
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId || null,
      });
      setTitle("");
      setDescription("");
      setProjectId("");
      setCreateOpen(false);
      refresh();
    } catch (e) {
      setError(e.message || "Kunde inte skapa arbetsorder");
    }
  };

  const projectName = projects.find((p) => String(p.id) === String(projectId))?.name;

  const statusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "in_progress") return "Pågående";
    if (s === "paused") return "Pausad";
    if (s === "closed" || s === "attested") return "Avslutad";
    return "Ej påbörjad";
  };

  const handleAction = async (action, id) => {
    try {
      if (action === "start") await startWorkOrder(id);
      if (action === "pause") await pauseWorkOrder(id);
      if (action === "close") await closeWorkOrder(id);
      refresh();
    } catch (e) {
      setError(e.message || "Kunde inte uppdatera arbetsorder");
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Arbetsorder</Text>
          <Text style={styles.subtitle}>{isAdmin ? "Alla arbetsorder" : "Mina arbetsorder"}</Text>
        </View>
        {isAdmin ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable onPress={() => setFilterType("active")} style={{ padding: 8 }}>
              <Text style={{ color: filterType === "active" ? colors.primary : colors.text }}>Aktiva</Text>
            </Pressable>
            <Pressable onPress={() => setFilterType("inactive")} style={{ padding: 8 }}>
              <Text style={{ color: filterType === "inactive" ? colors.primary : colors.text }}>Inaktiva</Text>
            </Pressable>
            <Pressable onPress={() => setFilterType("all")} style={{ padding: 8 }}>
              <Text style={{ color: filterType === "all" ? colors.primary : colors.text }}>Alla</Text>
            </Pressable>
          </View>
        ) : null}
        {isAdmin ? (
          <Pressable style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryButtonText}>Ny order</Text>
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
        renderItem={({ item }) => {
          // Filter by active/inactive if admin selected
          if (isAdmin) {
            if (filterType === "active" && (item.status === "closed" || item.status === "attested")) return null;
            if (filterType === "inactive" && !(item.status === "closed" || item.status === "attested")) return null;
          }
          return (
          <View style={[styles.card, cardShadow]}>
            <View style={styles.rowTop}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.statusBadge}>{statusLabel(item.status)}</Text>
            </View>
            {item.project_name ? <Text style={styles.muted}>Projekt: {item.project_name}</Text> : null}
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

            <View style={styles.actionsRow}> 
              <Pressable style={styles.outlineButton} onPress={() => handleAction("start", item.id)}>
                <Text style={styles.outlineText}>Starta</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={() => handleAction("pause", item.id)}>
                <Text style={styles.outlineText}>Pausa</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={() => handleAction("close", item.id)}>
                <Text style={styles.outlineText}>Avsluta</Text>
              </Pressable>
              {isAdmin ? (
                <>
                  <Pressable style={styles.outlineButton} onPress={() => openEdit(item)}>
                    <Text style={styles.outlineText}>Ändra</Text>
                  </Pressable>
                  <Pressable style={styles.outlineButton} onPress={() => confirmDelete(item)}>
                    <Text style={[styles.outlineText, { color: colors.danger }]}>Ta bort</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>Inga arbetsorder.</Text> : null}
      />

      <Modal visible={createOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Ny arbetsorder</Text>
            <Text style={styles.label}>Titel</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} />
            <Text style={styles.label}>Beskrivning</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.textarea]}
              multiline
            />

            <Text style={styles.label}>Projekt</Text>
            <Pressable style={styles.select} onPress={() => setProjectPickerOpen(true)}>
              <Text style={projectName ? styles.selectText : styles.selectPlaceholder}>
                {projectName || "Välj projekt (valfritt)"}
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable style={styles.outlineButton} onPress={() => setCreateOpen(false)}>
                <Text style={styles.outlineText}>Avbryt</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitCreate}>
                <Text style={styles.primaryButtonText}>Skapa</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={projectPickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj projekt</Text>
            <FlatList
              data={projects}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    // If editing, set editProjectId, else set projectId for create
                    if (editOpen) {
                      setEditProjectId(String(item.id));
                    } else {
                      setProjectId(String(item.id));
                    }
                    setProjectPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Inga projekt hittades.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setProjectPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Ändra arbetsorder</Text>
            <Text style={styles.label}>Titel</Text>
            <TextInput value={editTitle} onChangeText={setEditTitle} style={styles.input} />
            <Text style={styles.label}>Beskrivning</Text>
            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              style={[styles.input, styles.textarea]}
              multiline
            />

            <Text style={styles.label}>Projekt</Text>
            <Pressable style={styles.select} onPress={() => setProjectPickerOpen(true)}>
              <Text style={editProjectId ? styles.selectText : styles.selectPlaceholder}>
                {projects.find((p) => String(p.id) === String(editProjectId))?.name || "Välj projekt (valfritt)"}
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable style={styles.outlineButton} onPress={() => { setEditOpen(false); setEditingItem(null); }}>
                <Text style={styles.outlineText}>Avbryt</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitEdit}>
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
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  statusBadge: {
    backgroundColor: colors.navAccent,
    color: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: "hidden",
    fontWeight: "700",
  },
  description: {
    color: colors.text,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
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
    fontWeight: "600",
    color: colors.text,
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
    maxHeight: "70%",
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
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  select: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.surface,
  },
  selectText: {
    color: colors.text,
    fontWeight: "600",
  },
  selectPlaceholder: {
    color: colors.muted,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalItem: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalItemText: {
    fontWeight: "600",
    color: colors.text,
  },
  modalClose: {
    alignItems: "center",
    paddingVertical: 10,
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: "700",
  },
});
