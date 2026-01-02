import { apiFetch } from "./apiClient";

export function listAssignedWorkOrders() {
  return apiFetch("/work-orders/assigned");
}

export function listWorkOrders() {
  return apiFetch("/work-orders");
}

export function createWorkOrder(payload) {
  return apiFetch("/work-orders", {
    method: "POST",
    body: payload,
  });
}

export function startWorkOrder(id) {
  return apiFetch(`/work-orders/${id}/start`, { method: "POST" });
}

export function pauseWorkOrder(id) {
  return apiFetch(`/work-orders/${id}/pause`, { method: "POST" });
}

export function closeWorkOrder(id, reportText) {
  return apiFetch(`/work-orders/${id}/close`, {
    method: "POST",
    body: reportText ? { report_text: reportText } : {},
  });
}
