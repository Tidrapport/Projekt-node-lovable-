export type ApiError = { error?: string; message?: string; details?: string };

const TOKEN_KEY = "opero_token";
const LEGACY_TOKEN_KEY = "access_token";

export function getToken() {
  try {
    const local = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    // Allow a developer override via Vite env var `VITE_DEV_TOKEN` for local development
    const devToken = (import.meta as any).env?.VITE_DEV_TOKEN || (window as any).__DEV_API_TOKEN__;
    return local || devToken || null;
  } catch {
    // If localStorage isn't available (e.g. SSR), fall back to env var
    return (import.meta as any).env?.VITE_DEV_TOKEN || null;
  }
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

// Lightweight helpers that use relative paths so Vite proxy works in dev
export const api = {
  get: async <T>(path: string) => await apiFetch<T>(path),
  post: async <T>(path: string, body?: unknown) =>
    await apiFetch<T>(path, { method: "POST", json: body }),
  put: async <T>(path: string, body?: unknown) =>
    await apiFetch<T>(path, { method: "PUT", json: body }),
  del: async <T>(path: string) => await apiFetch<T>(path, { method: "DELETE" }),
};

// Robust apiFetch implementation: always use relative URLs (so Vite proxy applies),
// attach token if available, and safely parse JSON/text responses.
export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (!path) throw new Error("apiFetch: path is empty");

  // Ensure relative path so Vite dev server proxy can handle it
  const url = path.startsWith("/") ? path : `/${path}`;

  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = options.body !== undefined ? options.body : options.json !== undefined ? JSON.stringify(options.json) : undefined;
  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers, body } as RequestInit);

  const text = await res.text();
  if (!res.ok) {
    // Try to parse error body
    let parsed: any = undefined;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    const msg = (parsed && (parsed.error || parsed.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  if (!text) return undefined as unknown as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
