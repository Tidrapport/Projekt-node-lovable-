import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { createTimeEntry } from "../../src/api/timeEntries";
import { emit } from "../../src/lib/bus";

export default function TimeNew() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("16:00");
  const [breakMin, setBreakMin] = useState("30");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      // Anpassa keys om backend kräver andra fältnamn
      await createTimeEntry({
        date,
        start_time: start,
        end_time: end,
        break_minutes: Number(breakMin || 0),
        comment,
      });

      // Notify listeners that time entries changed so lists refresh automatically
      emit("timeEntries:changed");

      // Use replace to ensure we always end up on the Time tab regardless of history
      router.replace("/(app)/time");
    } catch (e) {
      setError(e.message || "Kunde inte spara tid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Ny tid</Text>

      <Text>Datum (YYYY-MM-DD)</Text>
      <TextInput value={date} onChangeText={setDate} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />

      <Text>Start (HH:MM)</Text>
      <TextInput value={start} onChangeText={setStart} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />

      <Text>Slut (HH:MM)</Text>
      <TextInput value={end} onChangeText={setEnd} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />

      <Text>Rast (min)</Text>
      <TextInput
        value={breakMin}
        onChangeText={setBreakMin}
        keyboardType="number-pad"
        style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
      />

      <Text>Kommentar</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        style={{ borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 60 }}
        multiline
      />

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Pressable
        disabled={busy}
        onPress={onSave}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          opacity: busy ? 0.6 : 1,
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <Text>{busy ? "Sparar…" : "Spara"}</Text>
      </Pressable>
    </View>
  );
}
