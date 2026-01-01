import { View, Text } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

export default function Admin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Redirect href="/(app)/dashboard" />;

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Admin</Text>
      <Text>Här bygger vi: attestering, projekt, arbetsorder-admin</Text>
    </View>
  );
}
