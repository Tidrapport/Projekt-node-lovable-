import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, clearToken, getToken, setToken } from "@/api/client";
import * as authApi from "@/api/auth";
import { ensureArray } from "@/lib/ensureArray";
import type { MenuSettings } from "@/lib/menuConfig";

type AuthContextType = {
  user: authApi.AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isImpersonated: boolean;
  companyId: number | null;
  homeCompanyId: number | null;
  company: { id: number; name?: string } | null;
  companyPlan: string | null;
  companyFeatures: string[] | null;
  menuSettings: MenuSettings | null;
  hasFeature: (feature: string) => boolean;
  login: (email: string, password: string, company_id?: number) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  signOut: () => void;
  updateMenuSettings: (settings: MenuSettings | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<authApi.AuthUser | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [homeCompanyId, setHomeCompanyId] = useState<number | null>(null);
  const [company, setCompany] = useState<{ id: number; name?: string } | null>(null);
  const [companyPlan, setCompanyPlan] = useState<string | null>(null);
  const [companyFeatures, setCompanyFeatures] = useState<string[] | null>(null);
  const [menuSettings, setMenuSettings] = useState<MenuSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isImpersonated, setIsImpersonated] = useState(false);

  const loadCompanyFeatures = useCallback(async (targetCompanyId: number | null) => {
    if (!targetCompanyId) {
      setCompanyPlan(null);
      setCompanyFeatures(null);
      return;
    }
    try {
      const data = await apiFetch<any[]>("/companies");
      const list = ensureArray<any>(data);
      const match = list.find((c) => String(c.id) === String(targetCompanyId));
      setCompanyPlan(match?.plan ? String(match.plan) : null);
      setCompanyFeatures(Array.isArray(match?.features) ? match.features : null);
    } catch {
      setCompanyPlan(null);
      setCompanyFeatures(null);
    }
  }, []);

  const loadMenuSettings = useCallback(
    async (targetCompanyId: number | null, fallbackCompanyId: number | null, allow: boolean) => {
      if (!allow) {
        setMenuSettings(null);
        return;
      }
      const scopedCompanyId = targetCompanyId ?? fallbackCompanyId ?? null;
      if (!scopedCompanyId) {
        setMenuSettings(null);
        return;
      }
      try {
        const path = `/admin/menu-settings?company_id=${encodeURIComponent(scopedCompanyId)}`;
        const data = await apiFetch<{ menu_settings?: MenuSettings }>(path);
        setMenuSettings(data?.menu_settings ?? null);
      } catch {
        setMenuSettings(null);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setCompanyId(null);
      setHomeCompanyId(null);
      setCompany(null);
      setCompanyPlan(null);
      setCompanyFeatures(null);
      setMenuSettings(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setIsImpersonated(false);
      return;
    }
    const me = await authApi.me();
    setUser(me.user);
    const effectiveCompanyId = me.company_id ?? null;
    setCompanyId(effectiveCompanyId);
    const resolvedHomeCompanyId = me.home_company_id ?? me.company_id ?? null;
    setHomeCompanyId(resolvedHomeCompanyId);
    setCompany(effectiveCompanyId ? { id: effectiveCompanyId } : null);
    setIsAdmin(me.is_admin);
    setIsSuperAdmin(me.is_super_admin);
    setIsImpersonated(!!me.impersonated);
    await loadCompanyFeatures(effectiveCompanyId);
    const allowMenuSettings = me.is_admin || me.is_super_admin;
    await loadMenuSettings(effectiveCompanyId, resolvedHomeCompanyId, allowMenuSettings);
  }, [loadCompanyFeatures, loadMenuSettings]);

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
      setCompanyPlan(null);
      setCompanyFeatures(null);
      setMenuSettings(null);
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
    setCompanyPlan(null);
    setCompanyFeatures(null);
    setMenuSettings(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsImpersonated(false);
  }, []);

  const hasFeature = useCallback(
    (feature: string) => {
      if (!feature) return true;
      if (companyFeatures === null) return true;
      return companyFeatures.includes(feature);
    },
    [companyFeatures]
  );

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
      companyPlan,
      companyFeatures,
      menuSettings,
      hasFeature,
      login,
      logout,
      refresh,
      signOut: logout,
      updateMenuSettings: setMenuSettings,
    }),
    [
      user,
      loading,
      isAdmin,
      isSuperAdmin,
      isImpersonated,
      companyId,
      homeCompanyId,
      company,
      companyPlan,
      companyFeatures,
      menuSettings,
      hasFeature,
      login,
      logout,
      refresh,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
