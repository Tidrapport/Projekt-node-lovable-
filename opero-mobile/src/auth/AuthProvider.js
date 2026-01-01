import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getToken, clearToken } from "./authStore";
import { me } from "../api/endpoints";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) { setUser(null); return; }
      const u = await me();
      setUser(u);
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
