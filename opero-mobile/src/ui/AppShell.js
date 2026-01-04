import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../api/apiClient";
import { spacing, radius, useTheme } from "./theme";

const drawerWidth = Math.min(300, Dimensions.get("window").width * 0.78);
const profileWidth = Math.min(280, Dimensions.get("window").width * 0.72);

export default function AppShell({ children }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const headerTextColor = isDark ? colors.navText : "#ffffff";
  const headerSubColor = isDark ? colors.navMuted : "#e2efff";
  const [companyName, setCompanyName] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(-drawerWidth)).current;
  const profileX = useRef(new Animated.Value(profileWidth)).current;

  useEffect(() => {
    Animated.timing(drawerX, {
      toValue: drawerOpen ? 0 : -drawerWidth,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, drawerX]);

  useEffect(() => {
    Animated.timing(profileX, {
      toValue: profileOpen ? 0 : profileWidth,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [profileOpen, profileX]);

  useEffect(() => {
    let active = true;
    const loadCompany = async () => {
      if (!user?.company_id) {
        setCompanyName("");
        return;
      }
      try {
        const data = await apiFetch("/companies");
        const list = Array.isArray(data) ? data : [];
        const match = list.find((row) => String(row.id) === String(user.company_id)) || list[0];
        if (active) {
          setCompanyName(match?.name || "");
        }
      } catch {
        if (active) setCompanyName("");
      }
    };
    loadCompany();
    return () => {
      active = false;
    };
  }, [user?.company_id]);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const menuSections = useMemo(() => {
    const baseSections = [
      {
        title: "Dashboard",
        items: [{ label: "Dashboard", icon: "stats-chart-outline", route: "/(app)/dashboard" }],
      },
      {
        title: "Timmar",
        items: [
          { label: "Registrera timmar", icon: "create-outline", route: "/(app)/time-new" },
          { label: "Översikt timmar", icon: "time-outline", route: "/(app)/time" },
          { label: "Planering", icon: "calendar-outline", route: "/(app)/planning" },
        ],
      },
      {
        title: "Arbete",
        items: [{ label: "Arbetsordrar", icon: "briefcase-outline", route: "/(app)/work-orders" }],
      },
      {
        title: "Dokument",
        items: [{ label: "Dokumentcenter", icon: "document-text-outline", route: "/(app)/documents" }],
      },
    ];

    const adminSection = isAdmin
      ? {
          title: "Admin",
          items: [
            { label: "Attestering", icon: "shield-checkmark-outline", route: "/(app)/admin?tab=attest" },
            { label: "Statistik", icon: "analytics-outline", route: "/(app)/admin?tab=stats" },
            { label: "Projektöversikt", icon: "folder-outline", route: "/(app)/projects" },
            { label: "Nytt projekt", icon: "add-circle-outline", route: "/(app)/projects?create=1" },
          ],
        }
      : null;

    const contactSection = {
      title: "Kontakter",
      items: [{ label: "Kontakter", icon: "call-outline", route: "/(app)/contacts" }],
    };

    return [...baseSections, adminSection, contactSection].filter(Boolean);
  }, [isAdmin]);

  const navigate = (route) => {
    setDrawerOpen(false);
    setProfileOpen(false);
    router.push(route);
  };

  const isActive = (route) => pathname === String(route).split("?")[0];

  const styles = useMemo(
    () => createStyles(colors, headerTextColor, headerSubColor),
    [colors, headerTextColor, headerSubColor]
  );

  // Target a smaller total header height (reduced ~15%). Compute a paddingTop that
  // respects half the safe-area inset but does not exceed the room available
  // (target - baseContentHeight). This keeps the header compact on devices
  // with a notch while avoiding overlap.
  const halfTop = Math.floor(insets.top / 2);
  const targetTotal = 51; // desired total header height in px (60 * 0.85)
  const baseContent = 44; // content area height
  const paddingTop = Math.max(0, Math.min(halfTop, targetTotal - baseContent));
  const headerHeight = paddingTop + baseContent;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, { paddingTop, height: paddingTop + baseContent }]}>
        <Pressable
          onPress={() => {
            setProfileOpen(false);
            setDrawerOpen(true);
          }}
          style={styles.headerIcon}
        >
          <Ionicons name="menu" size={20} color={headerTextColor} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brandOverline}>OPERO</Text>
          <Text style={styles.brandTitle}>{companyName || user?.company_name || "Företag"}</Text>
        </View>
        <Pressable
          onPress={() => {
            setDrawerOpen(false);
            setProfileOpen(true);
          }}
          style={styles.headerIcon}
        >
          <Ionicons name="person-circle" size={24} color={headerTextColor} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "height" : undefined}
        keyboardVerticalOffset={0}
      >
        {children}
      </KeyboardAvoidingView>

      {drawerOpen ? <Pressable style={styles.overlay} onPress={() => setDrawerOpen(false)} /> : null}
      {profileOpen ? <Pressable style={styles.overlay} onPress={() => setProfileOpen(false)} /> : null}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
        {/* Drawer header: align under the adjusted header using calculated headerHeight */}
        <View style={[styles.drawerHeader, { paddingTop: headerHeight + spacing.sm }]}>
          <Text style={styles.drawerTitle}>Meny</Text>
        </View>
        <ScrollView contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item) => (
                (() => {
                  const active = isActive(item.route);
                  const activeStyle = active
                    ? isDark
                      ? styles.menuItemActiveDark
                      : styles.menuItemActiveLight
                    : null;
                  const labelStyle = active && isDark ? styles.menuLabelActiveDark : null;
                  const iconWrapStyle = active && isDark ? styles.menuIconWrapActiveDark : null;
                  const iconColor = active && isDark ? "#ffffff" : colors.primary;
                  const chevronColor = active && isDark ? "#ffffff" : colors.navMuted;
                  return (
                <Pressable
                  key={item.route}
                  style={[styles.menuItem, activeStyle]}
                  onPress={() => navigate(item.route)}
                >
                  <View style={[styles.menuIconWrap, iconWrapStyle]}>
                    <Ionicons name={item.icon} size={18} color={iconColor} />
                  </View>
                  <Text style={[styles.menuLabel, labelStyle]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={chevronColor} />
                </Pressable>
                  );
                })()
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View style={[styles.profileDrawer, { transform: [{ translateX: profileX }], paddingTop: headerHeight + spacing.sm }]}>
        <View style={styles.profileHeader}>
          <Ionicons name="person-circle" size={46} color={colors.primary} />
          <Text style={styles.profileName}>{user?.full_name || user?.email || "Profil"}</Text>
          <Text style={styles.profileRole}>{user?.role || ""}</Text>
        </View>

        <View style={styles.profileList}>
          <Pressable style={styles.profileItem} onPress={() => { setProfileOpen(false); router.push("/(app)/change-password"); }}>
            <Ionicons name="key-outline" size={18} color={colors.primary} />
            <Text style={styles.profileItemText}>Byt lösenord</Text>
          </Pressable>
          <Pressable style={styles.profileItem} onPress={() => { setProfileOpen(false); router.push("/(app)/guides"); }}>
            <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.profileItemText}>Guider</Text>
          </Pressable>
          <View style={[styles.profileItem, styles.profileToggle]}>
            <View style={styles.profileToggleText}>
              <Ionicons name="contrast-outline" size={18} color={colors.primary} />
              <Text style={styles.profileItemText}>Mörk/Ljus vy</Text>
            </View>
            <Switch
              value={theme === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: "#cbd5f5", true: "#1d4ed8" }}
              thumbColor={theme === "dark" ? "#ffffff" : "#e2efff"}
            />
          </View>
          <Pressable
            style={[styles.profileItem, styles.profileLogout]}
            onPress={() => {
              setProfileOpen(false);
              logout();
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={styles.profileItemText}>Logga ut</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors, headerTextColor, headerSubColor) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navBgDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: 0,
    backgroundColor: colors.navBgDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
    gap: 1,
  },
  brandOverline: {
    color: headerSubColor,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  brandTitle: {
    color: headerTextColor,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: drawerWidth,
    backgroundColor: colors.navBg,
    paddingHorizontal: spacing.md,
  },
  drawerHeader: {
    marginBottom: spacing.md,
  },
  drawerTitle: {
    color: colors.navText,
    fontSize: 20,
    fontWeight: "800",
  },
  drawerBody: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.navMuted,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  menuItemActiveLight: {
    backgroundColor: colors.navAccent,
  },
  menuItemActiveDark: {
    backgroundColor: colors.primary,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.navAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    color: colors.navText,
    fontSize: 16,
    fontWeight: "600",
  },
  menuLabelActiveDark: {
    color: "#ffffff",
  },
  menuIconWrapActiveDark: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  profileDrawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: profileWidth,
    backgroundColor: colors.surface,
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  profileHeader: {
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  profileName: {
    color: colors.navText,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  profileRole: {
    color: colors.navMuted,
    fontSize: 12,
  },
  profileList: {
    gap: spacing.sm,
  },
  profileItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  profileItemText: {
    color: colors.navText,
    fontWeight: "600",
  },
  profileLogout: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  profileToggle: {
    justifyContent: "space-between",
  },
  profileToggleText: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
