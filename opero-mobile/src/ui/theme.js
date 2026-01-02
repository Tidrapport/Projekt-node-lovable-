import { createContext, useContext, useMemo, useState } from "react";
import { Platform } from "react-native";

export const lightColors = {
  background: "#f5f8fd",
  backgroundDark: "#0b1f3a",
  surface: "#ffffff",
  primary: "#0f4a8a",
  primaryDark: "#0b3a70",
  accent: "#3b82f6",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  navBg: "#ffffff",
  navBgDark: "#0f4a8a",
  navText: "#0f4a8a",
  navMuted: "#6b84a3",
  navAccent: "#e6f0ff",
  success: "#16a34a",
  danger: "#ef4444",
};

export const darkColors = {
  background: "#0b1f3a",
  backgroundDark: "#07162b",
  surface: "#0f2f57",
  primary: "#0f4a8a",
  primaryDark: "#0b3a70",
  accent: "#60a5fa",
  text: "#f8fafc",
  muted: "#c3d4ea",
  border: "#1c3f6e",
  navBg: "#0b1f3a",
  navBgDark: "#0f4a8a",
  navText: "#ffffff",
  navMuted: "#d1e0f5",
  navAccent: "#133a6b",
  success: "#22c55e",
  danger: "#f87171",
};

const ThemeContext = createContext({
  theme: "light",
  colors: lightColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
};

export const cardShadow = Platform.select({
  ios: {
    shadowColor: "#0b1b34",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: {
    elevation: 2,
  },
  default: {},
});
