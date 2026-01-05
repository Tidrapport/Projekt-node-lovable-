import { apiFetch } from "./apiClient";

export function listDeviationReports(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === "") return acc;
      acc[key] = String(value);
      return acc;
    }, {})
  ).toString();
  return apiFetch(`/deviation-reports${query ? `?${query}` : ""}`);
}

export function createDeviationReport(payload) {
  return apiFetch("/deviation-reports", {
    method: "POST",
    body: payload,
  });
}
