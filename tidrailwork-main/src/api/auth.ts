import { api, clearToken } from "./client";

export type AuthUser = {
  id: number;
  email: string;
  role: "user" | "admin" | "super_admin";
  company_id: number;
  full_name?: string;
};

export type LoginResponse = {
  access_token: string;
  user: AuthUser;
};

export type MeResponse = {
  user: AuthUser;
  role: AuthUser["role"];
  company_id: number;
  is_admin: boolean;
  is_super_admin: boolean;
  impersonated: boolean;
};

export async function login(email: string, password: string, company_id?: number) {
  return api.post<LoginResponse>("/auth/login", { email, password, company_id });
}

export async function me() {
  return api.get<MeResponse>("/auth/me");
}

export const getMe = me; // backward compatibility

export function logout() {
  clearToken();
}
