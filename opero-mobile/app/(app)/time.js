import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { listMyTimeEntries } from "../../src/api/timeEntries";
import { subscribe } from "../../src/lib/bus";

export default function Time() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listMyTimeEntries();
      // backend kan returnera array direkt eller {items:[]}
      const arr = Array.isArray(data) ? data : data?.items || [];
      // sortera senaste överst (nyaste date först)
      arr.sort((a, b) => String(b.date || b.work_date).localeCompare(String(a.date || a.work_date)));
      setItems(arr);
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

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Tidrapport</Text>

        <Pressable
          onPress={() => router.push("/(app)/time-new")}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 10 }}
        >
          <Text>Ny tid</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      {loading ? <Text>Laddar…</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontWeight: "700" }}>
              {item.date || item.work_date || "Datum?"}
            </Text>
            <Text>
              {item.start_time || item.start || "Start?"} – {item.end_time || item.end || "Slut?"}
            </Text>
            {item.comment ? <Text>📝 {item.comment}</Text> : null}
            {item.project_name ? <Text>Projekt: {item.project_name}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          !loading ? <Text>Inga tidrapporter ännu. Tryck “Ny tid”.</Text> : null
        }
      />
    </View>
  );
}
