import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "@/api/client";
import * as authApi from "@/api/auth";

type AuthContextType = {
  user: authApi.AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isImpersonated: boolean;
  companyId: number | null;
  homeCompanyId: number | null;
  company: { id: number; name?: string } | null;
  login: (email: string, password: string, company_id?: number) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<authApi.AuthUser | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [homeCompanyId, setHomeCompanyId] = useState<number | null>(null);
  const [company, setCompany] = useState<{ id: number; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isImpersonated, setIsImpersonated] = useState(false);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setCompanyId(null);
      setHomeCompanyId(null);
      setCompany(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setIsImpersonated(false);
      return;
    }
    const me = await authApi.me();
    setUser(me.user);
    setCompanyId(me.company_id ?? null);
    setHomeCompanyId(me.home_company_id ?? me.company_id ?? null);
    setCompany(me.company_id ? { id: me.company_id } : null);
    setIsAdmin(me.is_admin);
    setIsSuperAdmin(me.is_super_admin);
    setIsImpersonated(!!me.impersonated);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch {
        clearToken();
        setUser(null);
        setCompanyId(null);
        setHomeCompanyId(null);
        setCompany(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsImpersonated(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string, company_id?: number) => {
      setLoading(true);
      try {
        const res = await authApi.login(email, password, company_id);
        setToken(res.access_token);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setCompanyId(null);
    setHomeCompanyId(null);
    setCompany(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsImpersonated(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin,
      isSuperAdmin,
      isImpersonated,
      companyId,
      homeCompanyId,
      company,
      login,
      logout,
      refresh,
      signOut: logout,
    }),
    [user, loading, isAdmin, isSuperAdmin, isImpersonated, companyId, homeCompanyId, company, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
