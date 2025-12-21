import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "@/api/auth";

type User = authApi.MeResponse["user"];

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  async function refreshMe() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      return;
    }
    const me = await authApi.getMe();
    setUser(me.user);
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      await authApi.login(email, password);
      await refreshMe();
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    authApi.logout();
    setUser(null);
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch {
        // token kan vara invalid -> rensa
        authApi.logout();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAuthenticated, login, refreshMe, logout }),
    [user, loading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
