import { apiFetch } from "./apiClient";

export function listTimeEntries(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === "") return acc;
      acc[key] = String(value);
      return acc;
    }, {})
  ).toString();
  return apiFetch(`/time-entries${query ? `?${query}` : ""}`);
}

export function listMyTimeEntries(params = {}) {
  return listTimeEntries(params);
}

export function createTimeEntry(payload) {
  return apiFetch("/time-entries", {
    method: "POST",
    body: payload,
  });
}

export function updateTimeEntry(id, payload) {
  return apiFetch(`/time-entries/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteTimeEntry(id) {
  return apiFetch(`/time-entries/${id}`, {
    method: "DELETE",
  });
}

export function attestTimeEntry(id, approved = true) {
  return apiFetch(`/time-entries/${id}/attest`, {
    method: "POST",
    body: { approved },
  });
}

export function addTimeEntryMaterial(id, payload) {
  return apiFetch(`/time-entries/${id}/materials`, {
    method: "POST",
    body: payload,
  });
}

export function updateTimeEntryMaterial(id, materialRowId, payload) {
  return apiFetch(`/time-entries/${id}/materials/${materialRowId}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteTimeEntryMaterial(id, materialRowId) {
  return apiFetch(`/time-entries/${id}/materials/${materialRowId}`, {
    method: "DELETE",
  });
}
