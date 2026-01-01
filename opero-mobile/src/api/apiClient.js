import { API_BASE_URL } from "../config";
import { getToken, clearToken } from "../auth/authStore";

export async function apiFetch(path, options = {}) {
  const token = await getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (res.status === 401) await clearToken();
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data;
}
