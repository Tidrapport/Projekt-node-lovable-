import { apiFetch } from "./apiClient";

export function listContacts() {
  return apiFetch("/profiles?order=full_name");
}
