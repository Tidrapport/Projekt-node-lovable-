import { apiFetch } from "./client";

export type MeResponse = {
  user: {
    id: number | string;
    email: string;
    role: string;
    company_id: number | string | null;
    full_name?: string;
  };
  role: string;
  company_id: number | string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  impersonated: boolean;
};

export async function login(email: string, password: string) {
  const data = await apiFetch<{ access_token: string }>("/auth/login", {
    json: { email, password },
  });

  localStorage.setItem("access_token", data.access_token);
  return data;
}

export async function getMe() {
  return apiFetch<MeResponse>("/auth/me");
}

export function logout() {
  localStorage.removeItem("access_token");
}
