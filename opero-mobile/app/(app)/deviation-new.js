import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { listMyTimeEntries } from "../../src/api/timeEntries";
import { createDeviationReport } from "../../src/api/deviations";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

const severityOptions = [
  { label: "Låg", value: "low" },
  { label: "Medel", value: "medium" },
  { label: "Hög", value: "high" },
  { label: "Kritisk", value: "critical" },
];

const formatEntryLabel = (entry) => {
  if (!entry) return "";
  const date = entry.datum || entry.date || entry.work_date || "";
  const start = entry.starttid || entry.start_time || entry.start || "";
  const end = entry.sluttid || entry.end_time || entry.end || "";
  const timePart = start && end ? `${start} - ${end}` : "";
  const project = entry.project_name || entry.project?.name || "";
  const left = [date, timePart].filter(Boolean).join(" ");
  if (left && project) return `${left} • ${project}`;
  return left || project || "Tidrapport";
};

export default function DeviationNew() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [timeEntries, setTimeEntries] = useState([]);
  const [timeEntryId, setTimeEntryId] = useState("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [severityPickerOpen, setSeverityPickerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setTimeEntries([]);
        return;
      }
      setLoadingEntries(true);
      setError(null);
      try {
        const data = await listMyTimeEntries({ limit: 200, user_id: user?.id });
        const arr = Array.isArray(data) ? data : data?.items || [];
        const sorted = [...arr].sort((a, b) =>
          String(b.datum || b.date || b.work_date).localeCompare(String(a.datum || a.date || a.work_date))
        );
        setTimeEntries(sorted);
      } catch (e) {
        setError(e.message || "Kunde inte hämta tidrapporter");
        setTimeEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    };
    load();
  }, [user?.id]);

  const selectedEntry = timeEntries.find((entry) => String(entry.id) === String(timeEntryId));
  const selectedSeverity = severityOptions.find((opt) => opt.value === severity);

  const submit = async () => {
    if (!timeEntryId) {
      Alert.alert("Välj tidrapport", "Du måste koppla avvikelsen till en tidrapport.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Fyll i titel", "Skriv en kort titel för avvikelsen.");
      return;
    }
    setSaving(true);
    try {
      await createDeviationReport({
        time_entry_id: timeEntryId,
        title: title.trim(),
        description: description.trim(),
        severity,
        status: "open",
      });
      Alert.alert("Avvikelse registrerad", "Avvikelsen är nu sparad.");
      router.back();
    } catch (e) {
      Alert.alert("Kunde inte registrera", e?.message || "Försök igen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.title}>Registrera avvikelse</Text>
        <Text style={styles.muted}>Koppla avvikelsen till en tidrapport och beskriv vad som hänt.</Text>

        <Text style={styles.label}>Tidrapport</Text>
        <Pressable style={styles.select} onPress={() => setTimePickerOpen(true)}>
          <Text style={selectedEntry ? styles.selectText : styles.selectPlaceholder}>
            {selectedEntry
              ? formatEntryLabel(selectedEntry)
              : loadingEntries
                ? "Laddar tidrapporter..."
                : "Välj tidrapport"}
          </Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Titel</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Kort titel"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Allvarlighetsgrad</Text>
        <Pressable style={styles.select} onPress={() => setSeverityPickerOpen(true)}>
          <Text style={styles.selectText}>{selectedSeverity?.label || "Medel"}</Text>
        </Pressable>

        <Text style={styles.label}>Beskrivning</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Beskriv avvikelsen..."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <Pressable
          style={[styles.primaryButton, { opacity: saving ? 0.6 : 1 }]}
          onPress={submit}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Skickar..." : "Skicka avvikelse"}</Text>
        </Pressable>
      </View>

      <Modal visible={timePickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj tidrapport</Text>
            <FlatList
              data={timeEntries}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setTimeEntryId(String(item.id));
                    setTimePickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{formatEntryLabel(item)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.muted}>Inga tidrapporter hittades.</Text>
              }
            />
            <Pressable style={styles.modalClose} onPress={() => setTimePickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={severityPickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj allvarlighetsgrad</Text>
            {severityOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.modalItem}
                onPress={() => {
                  setSeverity(opt.value);
                  setSeverityPickerOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{opt.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalClose} onPress={() => setSeverityPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  label: {
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.xs,
  },
  muted: {
    color: colors.muted,
  },
  errorText: {
    color: colors.danger,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: "80%",
    padding: spacing.md,
  },
  modalTitle: {
    fontWeight: "800",
    color: colors.text,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  modalItem: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  modalItemText: {
    color: colors.text,
    fontWeight: "600",
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
