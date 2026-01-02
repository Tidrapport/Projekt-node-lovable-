import { apiFetch } from "./apiClient";

export function listDocuments() {
  return apiFetch("/admin/tdok-docs");
}
