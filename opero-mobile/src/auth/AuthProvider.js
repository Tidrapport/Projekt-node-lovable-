import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getToken, clearToken } from "./authStore";
import { me } from "../api/endpoints";
import { registerForPushNotificationsAsync } from "../notifications/push";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const didRegisterPush = useRef(false);

  const normalizeUser = (payload) => {
    if (!payload) return null;
    if (payload.user) {
      return {
        ...payload.user,
        role: payload.role || payload.user.role,
        company_id: payload.company_id ?? payload.user.company_id,
        full_name: payload.user.full_name || payload.user.name || payload.user.email,
      };
    }
    return payload;
  };

  const refresh = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) { setUser(null); return; }
      const u = await me();
      setUser(normalizeUser(u));
    } catch {
      setUser(null);
      await clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!user) {
      didRegisterPush.current = false;
      return;
    }
    if (didRegisterPush.current) return;
    didRegisterPush.current = true;
    registerForPushNotificationsAsync().catch((err) => {
      console.warn("Push registration failed:", err?.message || err);
    });
  }, [user?.id]);

  const value = useMemo(
    () => ({
      isLoading,
      isAuthed: !!user,
      user,
      setUser,
      refresh,
      logout,
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
