import { apiFetch } from "./apiClient";

export function listProjects() {
  return apiFetch("/projects");
}

export function createProject(payload) {
  return apiFetch("/projects", {
    method: "POST",
    body: payload,
  });
}
