import { View, Text } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";

export default function Profile() {
  const { user } = useAuth();

  return (
    <View style={{ flex: 1, padding: 20, gap: 6 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Profil</Text>
      <Text>ID: {user?.id}</Text>
      <Text>Email: {user?.email}</Text>
      <Text>Company: {user?.company_id}</Text>
    </View>
  );
}
