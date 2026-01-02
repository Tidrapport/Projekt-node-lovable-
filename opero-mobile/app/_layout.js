import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth/AuthProvider";
import { ThemeProvider } from "../src/ui/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
