import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import AppShell from "../../src/ui/AppShell";

export default function AppLayout() {
  const { isLoading, isAuthed } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAuthed) return <Redirect href="/login" />;

  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
