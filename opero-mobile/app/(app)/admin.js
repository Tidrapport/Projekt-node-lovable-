import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { listTimeEntries, attestTimeEntry, deleteTimeEntry } from "../../src/api/timeEntries";
import { listMaterialTypes } from "../../src/api/meta";
import { listContacts } from "../../src/api/contacts";
import { sendPushToUsers } from "../../src/api/push";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Admin() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  if (user?.role !== "admin" && user?.role !== "super_admin") return <Redirect href="/(app)/dashboard" />;

  const { tab } = useLocalSearchParams();
  const activeTab = tab === "stats" ? "stats" : "attest";

  const [entries, setEntries] = useState([]);
  const [materialTypes, setMaterialTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [pushMessage, setPushMessage] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekStats, setWeekStats] = useState([]);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [pendingData, statsData, materialData, contactsData] = await Promise.all([
          listTimeEntries({ limit: 50, include_materials: true }),
          listTimeEntries({ from: daysAgo(42) }),
          listMaterialTypes(),
          listContacts(),
        ]);
        setEntries(Array.isArray(pendingData) ? pendingData : []);
        setMaterialTypes(Array.isArray(materialData) ? materialData : []);
        setContacts(Array.isArray(contactsData) ? contactsData : []);
        setWeekStats(buildWeekStats(Array.isArray(statsData) ? statsData : []));
      } catch (e) {
        setError(e.message || "Kunde inte hämta tidrapporter");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openDetails = (entry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setDetailEntry(null);
    setDetailOpen(false);
  };

  const materialName = (materialTypeId) => {
    const found = materialTypes.find((mt) => String(mt.id) === String(materialTypeId));
    return found?.name || `#${materialTypeId}`;
  };

  const attest = async (id, approved = true) => {
    try {
      await attestTimeEntry(id, approved);
      setEntries((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? { ...item, status: approved ? "Attesterad" : "Ny" }
            : item
        )
      );
    } catch (e) {
      setError(e.message || "Kunde inte attestera");
    }
  };

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      const id = String(userId);
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const sendPush = async () => {
    setError(null);
    if (!pushMessage.trim()) {
      setError("Skriv ett meddelande för push-notisen.");
      return;
    }
    if (selectedUserIds.length === 0) {
      setError("Välj minst en användare.");
      return;
    }
    setPushSending(true);
    try {
      await sendPushToUsers(selectedUserIds, pushMessage.trim());
      setPushMessage("");
      setSelectedUserIds([]);
    } catch (e) {
      setError(e.message || "Kunde inte skicka push-notis.");
    } finally {
      setPushSending(false);
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Admin</Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === "attest" && styles.tabButtonActive]}
            onPress={() => router.push("/(app)/admin?tab=attest")}
          >
            <Text style={[styles.tabText, activeTab === "attest" && styles.tabTextActive]}>Attestering</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "stats" && styles.tabButtonActive]}
            onPress={() => router.push("/(app)/admin?tab=stats")}
          >
            <Text style={[styles.tabText, activeTab === "stats" && styles.tabTextActive]}>Statistik</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {activeTab === "stats" ? (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.sectionTitle}>Statistik per vecka</Text>
            {weekStats.length === 0 ? (
              <Text style={styles.muted}>Ingen statistik tillgänglig.</Text>
            ) : (
              weekStats.map((row) => (
                <View key={row.week} style={styles.row}>
                  <Text style={styles.rowTitle}>{row.week}</Text>
                  <Text style={styles.muted}>
                    {row.reports} rapporter • {row.users} användare • {row.hours.toFixed(1)} h
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <>
            <View style={[styles.card, cardShadow]}>
              <Text style={styles.sectionTitle}>Snabb attestering</Text>
              {loading ? <Text style={styles.muted}>Laddar…</Text> : null}
              <FlatList
                data={entries}
                keyExtractor={(item) => String(item.id)}
                ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
                scrollEnabled={false}
                initialNumToRender={Math.max(entries.length, 1)}
                maxToRenderPerBatch={Math.max(entries.length, 1)}
                removeClippedSubviews={false}
                renderItem={({ item }) => (
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.user_full_name || item.user_email || "Användare"}</Text>
                      <Text style={styles.muted}>
                        {item.datum || item.date || "Datum?"} •{" "}
                        {Number(item.timmar || item.total_hours || 0).toFixed(1)} h
                      </Text>
                      <Text style={styles.muted}>Status: {item.status || "Ny"}</Text>
                    </View>
                    <View style={styles.actionColumn}>
                    {item.status !== "Attesterad" ? (
                      <Pressable style={styles.primaryButtonSmall} onPress={() => attest(item.id, true)}>
                        <Text style={styles.primaryButtonText}>Attestera</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={styles.outlineButtonSmall} onPress={() => attest(item.id, false)}>
                        <Text style={styles.outlineText}>Lås upp</Text>
                      </Pressable>
                    )}
                      <Pressable
                        style={styles.outlineButtonSmall}
                        onPress={() =>
                          router.push({
                            pathname: "/(app)/time-new",
                            params: { id: String(item.id), returnTo: "/(app)/admin?tab=attest" },
                          })
                        }
                      >
                        <Text style={styles.outlineText}>Ändra</Text>
                      </Pressable>
                      <Pressable style={styles.outlineButtonSmall} onPress={() => openDetails(item)}>
                        <Text style={styles.outlineText}>Visa</Text>
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
                                    setEntries((prev) => prev.filter((row) => String(row.id) !== String(item.id)));
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
                  </View>
                )}
                ListEmptyComponent={!loading ? <Text style={styles.muted}>Inga tidrapporter.</Text> : null}
              />
            </View>

            <View style={[styles.card, cardShadow]}>
              <Text style={styles.sectionTitle}>Skicka push-notis</Text>
              <Text style={styles.muted}>Välj användare och skriv ett meddelande.</Text>
              <View style={styles.userWrap}>
                {contacts.map((contact) => {
                  const id = String(contact.id);
                  const selected = selectedUserIds.includes(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => toggleUser(id)}
                      style={[styles.userChip, selected && styles.userChipActive]}
                    >
                      <Text style={[styles.userChipText, selected && styles.userChipTextActive]}>
                        {contact.full_name || contact.email}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={pushMessage}
                onChangeText={setPushMessage}
                placeholder="Registrering av tiden omgående"
                style={[styles.input, styles.textarea]}
                multiline
              />
              <Pressable style={styles.primaryButton} onPress={sendPush} disabled={pushSending}>
                <Text style={styles.primaryButtonText}>{pushSending ? "Skickar..." : "Skicka notis"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      <Modal visible={detailOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Tidrapport</Text>
            {detailEntry ? (
              <View style={styles.detailBody}>
                <Text style={styles.detailLine}>
                  {detailEntry.user_full_name || detailEntry.user_email || "Användare"}
                </Text>
                <Text style={styles.detailMuted}>
                  {detailEntry.datum || detailEntry.date || "Datum?"} •{" "}
                  {detailEntry.starttid || detailEntry.start_time || detailEntry.start || "Start?"} –{" "}
                  {detailEntry.sluttid || detailEntry.end_time || detailEntry.end || "Slut?"}
                </Text>
                <Text style={styles.detailMuted}>
                  Timmar: {Number(detailEntry.timmar || detailEntry.total_hours || 0).toFixed(1)} h
                </Text>
                {detailEntry.project_name ? (
                  <Text style={styles.detailMuted}>Projekt: {detailEntry.project_name}</Text>
                ) : null}
                {detailEntry.subproject_name ? (
                  <Text style={styles.detailMuted}>Underprojekt: {detailEntry.subproject_name}</Text>
                ) : null}
                {detailEntry.job_role_name ? (
                  <Text style={styles.detailMuted}>Yrkesroll: {detailEntry.job_role_name}</Text>
                ) : null}
                {detailEntry.restid ? (
                  <Text style={styles.detailMuted}>Restid: {detailEntry.restid} h</Text>
                ) : null}
                {detailEntry.overtime_weekday_hours ? (
                  <Text style={styles.detailMuted}>ÖT vardag: {detailEntry.overtime_weekday_hours} h</Text>
                ) : null}
                {detailEntry.overtime_weekend_hours ? (
                  <Text style={styles.detailMuted}>ÖT helg: {detailEntry.overtime_weekend_hours} h</Text>
                ) : null}
                {detailEntry.comp_time_saved_hours ? (
                  <Text style={styles.detailMuted}>Komp sparad: {detailEntry.comp_time_saved_hours} h</Text>
                ) : null}
                {detailEntry.comp_time_taken_hours ? (
                  <Text style={styles.detailMuted}>Komp uttagen: {detailEntry.comp_time_taken_hours} h</Text>
                ) : null}
                {detailEntry.comment ? (
                  <Text style={styles.detailNotes}>📝 {detailEntry.comment}</Text>
                ) : null}
                {Array.isArray(detailEntry.materials) && detailEntry.materials.length > 0 ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Tillägg</Text>
                    {detailEntry.materials.map((mat) => (
                      <Text key={String(mat.id)} style={styles.detailMuted}>
                        {materialName(mat.material_type_id)} • {mat.quantity} st{mat.place ? ` • ${mat.place}` : ""}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            <Pressable style={styles.modalClose} onPress={closeDetails}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const getWeekKey = (dateStr) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-v${weekNo}`;
};

const buildWeekStats = (entries) => {
  const map = new Map();
  entries.forEach((entry) => {
    const key = getWeekKey(entry.datum || entry.date);
    if (!key) return;
    const current = map.get(key) || { reports: 0, users: new Set(), hours: 0 };
    current.reports += 1;
    current.hours += Number(entry.timmar || entry.total_hours || 0);
    const userId = entry.user_id || entry.user_full_name || entry.user_email;
    if (userId) current.users.add(String(userId));
    map.set(key, current);
  });
  return Array.from(map.entries())
    .map(([week, data]) => ({
      week,
      reports: data.reports,
      users: data.users.size,
      hours: data.hours,
    }))
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, 6);
};

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
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
    gap: spacing.sm,
  },
  sectionTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowTitle: {
    fontWeight: "700",
    color: colors.text,
  },
  cardRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  actionColumn: {
    gap: spacing.xs,
  },
  userWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  userChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  userChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userChipText: {
    color: colors.text,
    fontWeight: "600",
  },
  userChipTextActive: {
    color: "#fff",
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontWeight: "700",
    color: colors.text,
  },
  tabTextActive: {
    color: "#fff",
  },
  primaryButtonSmall: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  outlineButtonSmall: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  dangerText: {
    fontWeight: "700",
    color: colors.danger,
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
    maxHeight: "80%",
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
  modalClose: {
    alignItems: "center",
    paddingVertical: 10,
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: "700",
  },
  detailBody: {
    gap: spacing.xs,
  },
  detailLine: {
    fontWeight: "800",
    color: colors.text,
  },
  detailMuted: {
    color: colors.muted,
  },
  detailNotes: {
    color: colors.text,
  },
  detailSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  detailSectionTitle: {
    fontWeight: "700",
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
  errorText: {
    color: colors.danger,
  },
});
