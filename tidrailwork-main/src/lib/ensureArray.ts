export function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  // Common wrapper shapes
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.rows)) return value.rows;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.workOrders)) return value.workOrders;
  if (Array.isArray(value.companies)) return value.companies;
  if (Array.isArray(value.projects)) return value.projects;
  if (Array.isArray(value.job_roles)) return value.job_roles;
  if (Array.isArray(value.material_types)) return value.material_types;
  // Helpful debug: if running in development, warn about unexpected response shapes.
  try {
    const shouldWarn = typeof window !== "undefined" && (window as any).__DEBUG_ENSURE_ARRAY === true;
    if (shouldWarn) {
      // eslint-disable-next-line no-console
      console.warn("ensureArray: unexpected API response shape", value);
    }
  } catch (_) {
    // ignore when window is not available
  }
  return [];
}
