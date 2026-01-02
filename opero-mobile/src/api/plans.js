import { apiFetch } from "./apiClient";

export function listPlans(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === "") return acc;
      acc[key] = String(value);
      return acc;
    }, {})
  ).toString();
  return apiFetch(`/plans${query ? `?${query}` : ""}`);
}
