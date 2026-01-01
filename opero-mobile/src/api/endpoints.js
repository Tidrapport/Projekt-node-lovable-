import { apiFetch } from "./apiClient";
import { setToken } from "../auth/authStore";

export async function login(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  // ✅ rätt token-fält
  if (!data?.access_token) {
    throw new Error("Login svar saknar access_token");
  }

  await setToken(data.access_token);

  // Returnera user direkt (snabbare UX)
  return data.user;
}

export async function me() {
  return apiFetch("/auth/me");
}
