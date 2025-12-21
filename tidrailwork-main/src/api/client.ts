// src/api/client.ts
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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = localStorage.getItem("access_token");

  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const body = options.body !== undefined ? options.body : (options.json !== undefined ? JSON.stringify(options.json) : undefined);
  const method = options.method || (body !== undefined ? "POST" : "GET");

  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body,
  });

  // försök läsa json om det finns
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
