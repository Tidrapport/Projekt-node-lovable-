import { apiFetch } from "./apiClient";

export function listJobRoles() {
  return apiFetch("/job-roles");
}

export function listSubprojects(projectId) {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return apiFetch(`/subprojects${query}`);
}

export function listMaterialTypes() {
  return apiFetch("/material-types");
}
