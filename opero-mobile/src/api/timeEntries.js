import { apiFetch } from "./apiClient";

export function listMyTimeEntries() {
  return apiFetch("/time-entries");
}

export function createTimeEntry(payload) {
  return apiFetch("/time-entries", {
    method: "POST",
    body: payload,
  });
}
