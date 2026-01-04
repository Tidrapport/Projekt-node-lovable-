import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { createOffer, listCustomers } from "../../src/api/fortnox";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function OfferPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [customers, setCustomers] = useState([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");

  const [items, setItems] = useState([]);
  const [lineDesc, setLineDesc] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [linePrice, setLinePrice] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await listCustomers();
        setCustomers(Array.isArray(data) ? data : []);
      } catch {
        setCustomers([]);
      }
    };
    loadCustomers();
  }, []);

  const addLine = () => {
    const qty = Number(lineQty) || 0;
    const price = Number(linePrice) || 0;
    if (!lineDesc || qty <= 0 || price <= 0) {
      Alert.alert("Fyll i radens beskrivning, antal och pris");
      return;
    }
    setItems((s) => [...s, { id: Date.now().toString(), description: lineDesc, qty, price }]);
    setLineDesc("");
    setLineQty("1");
    setLinePrice("");
  };

  const removeLine = (id) => setItems((s) => s.filter((l) => l.id !== id));

  const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);

  const submit = async () => {
    if (!customerId) {
      Alert.alert("Välj kund först");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Lägg till minst en rad i offerten");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        customer_id: customerId,
        lines: items.map((it) => ({ description: it.description, qty: it.qty, unit_price: it.price })),
        created_by: user?.id,
        note: "Skapad från Opero Mobile (Offert)",
      };
      await createOffer(payload);
      Alert.alert("Offert skickad", "Offert skickad till Fortnox");
      router.back();
    } catch (err) {
      Alert.alert("Kunde inte skapa offert", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.label}>Kund</Text>
        <Pressable style={styles.select} onPress={() => setCustomerPickerOpen(true)}>
          <Text style={customerName ? styles.selectText : styles.selectPlaceholder}>{customerName || "Välj kund"}</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: spacing.sm }]}>Rader</Text>
        {items.map((it) => (
          <View key={it.id} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineDesc}>{it.description}</Text>
              <Text style={styles.muted}>{it.qty} × {it.price.toFixed(2)} kr</Text>
            </View>
            <Pressable onPress={() => removeLine(it.id)} style={styles.removeBtn}>
              <Text style={styles.removeText}>Ta bort</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.addRow}>
          <TextInput placeholder="Beskrivning" value={lineDesc} onChangeText={setLineDesc} style={styles.input} />
          <TextInput placeholder="Antal" value={lineQty} onChangeText={setLineQty} keyboardType="numeric" style={[styles.input, { width: 80 }]} />
          <TextInput placeholder="Pris" value={linePrice} onChangeText={setLinePrice} keyboardType="numeric" style={[styles.input, { width: 100 }]} />
          <Pressable style={styles.addBtn} onPress={addLine}><Text style={styles.addBtnText}>Lägg till</Text></Pressable>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total.toFixed(2)} kr</Text>
        </View>

        <Pressable style={[styles.primaryButton, { opacity: loading ? 0.6 : 1 }]} onPress={submit} disabled={loading}>
          <Text style={styles.primaryButtonText}>Skapa offert</Text>
        </Pressable>
      </View>

      <Modal visible={customerPickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj kund</Text>
            <FlatList
              data={customers}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setCustomerId(String(item.id));
                    setCustomerName(item.name || item.company_name || item.full_name || item.email || "Kund");
                    setCustomerPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name || item.company_name || item.full_name || item.email}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Inga kunder hittades.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setCustomerPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  label: { fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  select: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.surface },
  selectText: { color: colors.text, fontWeight: "600" },
  selectPlaceholder: { color: colors.muted },
  lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  lineDesc: { fontWeight: "600", color: colors.text },
  muted: { color: colors.muted },
  removeBtn: { padding: 8 },
  removeText: { color: colors.danger, fontWeight: "700" },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 8, backgroundColor: colors.surface, color: colors.text, flex: 1 },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
  addBtnText: { color: "#fff", fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  totalLabel: { fontWeight: "800", color: colors.text },
  totalValue: { fontWeight: "800", color: colors.text },
  primaryButton: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "800" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: spacing.md },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, maxHeight: "80%", padding: spacing.md },
  modalTitle: { fontWeight: "800", color: colors.text, fontSize: 18, marginBottom: spacing.sm },
  modalItem: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  modalItemText: { color: colors.text, fontWeight: "600" },
  modalClose: { alignItems: "center", paddingVertical: 10 },
  modalCloseText: { color: colors.primary, fontWeight: "700" },
});
