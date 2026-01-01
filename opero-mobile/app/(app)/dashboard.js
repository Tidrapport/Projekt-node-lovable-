import { ScrollView, Text, Pressable } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Dashboard</Text>

      <Text>Roll: {user?.role}</Text>
      <Text>Email: {user?.email}</Text>
      <Text>Namn: {user?.full_name}</Text>

      <Pressable
        onPress={logout}
        style={{ padding: 12, borderWidth: 1, borderRadius: 10 }}
      >
        <Text>Logga ut</Text>
      </Pressable>
    </ScrollView>
  );
}
