import { Tabs } from "expo-router";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";

export default function AppLayout() {
  const { isLoading, isAuthed, user } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAuthed) return <Redirect href="/login" />;

  const isAdmin = user?.role === "admin";

  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="time" options={{ title: "Tid" }} />
      <Tabs.Screen name="work-orders" options={{ title: "Order" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />

      {/* Admin-tabben syns bara för admin */}
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: isAdmin ? "./admin" : null,
        }}
      />
    </Tabs>
  );
}
