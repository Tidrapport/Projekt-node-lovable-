export type ApiError = { error?: string; message?: string; details?: string };

const TOKEN_KEY = "opero_token";
const LEGACY_TOKEN_KEY = "access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

type ApiFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  json?: unknown;
  body?: BodyInit;
};

function buildUrl(path: string) {
  // I dev kör vi via Vite proxy (vite.config.ts) => använd relativa paths
  // I prod kan du sätta VITE_API_BASE_URL=https://din-server
  const base = import.meta.env.VITE_API_BASE_URL?.trim() || "";
  if (!base) return path;
  return `${base}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(buildUrl(path), { ...init, headers });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const msg = body?.error || body?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  // 204 no content
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : "{}" }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : "{}" }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Backward compatibility helper
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const body =
    options.body !== undefined
      ? options.body
      : options.json !== undefined
        ? JSON.stringify(options.json)
        : undefined;
  const method = options.method || (body !== undefined ? "POST" : "GET");

  return request<T>(path, { method, headers, body });
}
