import { apiFetch } from "./apiClient";

// Create an offer in Fortnox via backend. The backend should treat
// `as_offer: true` to create an offer (not an invoice) and hide any ORC/Invoice
// number fields when returning the result.
export function createOffer(payload) {
  return apiFetch("/admin/fortnox/push_invoice", {
    method: "POST",
    json: { ...payload, as_offer: true },
  });
}

// Fetch customers list from backend
export function listCustomers() {
  return apiFetch("/customers");
}
