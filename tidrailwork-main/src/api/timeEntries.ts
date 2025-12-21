import { api } from "./client";

type RawMaterial = {
  id: number | string;
  report_id: number | string;
  material_type_id: number | string;
  quantity: number;
  material_name?: string | null;
  material_unit?: string | null;
  place?: string | null;
};

type RawTimeEntry = {
  id: number | string;
  user_id: number | string;
  datum?: string;
  date?: string;
  starttid?: string | null;
  sluttid?: string | null;
  timmar?: number | string | null;
  project_id?: number | string | null;
  subproject_id?: number | string | null;
  job_role_id?: number | string | null;
  comment?: string | null;
  status?: string | null;
  attested_by?: number | string | null;
  attested_at?: string | null;
  project_name?: string | null;
  subproject_name?: string | null;
  job_role_name?: string | null;
  materials?: RawMaterial[];
};

export type TimeEntry = {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  project_id: string;
  subproject_id: string | null;
  job_role_id: string | null;
  work_description: string;
  status?: string | null;
  attested_by?: string | null;
  attested_at?: string | null;
  project?: { name: string };
  subproject?: { name: string };
  job_role?: { name: string };
  material_reports?: {
    id: string;
    quantity: number;
    material_type: { name: string; unit: string };
  }[];
};

type ListParams = {
  user_id?: string | number;
  from?: string;
  to?: string;
  includeMaterials?: boolean;
  project_id?: string | number;
  status?: string;
};

type CreatePayload = {
  user_id?: string | number;
  date: string;
  hours: number;
  project_id?: string;
  subproject_id?: string;
  job_role_id?: string;
  description?: string;
  status?: string;
  allowance_type?: string;
  allowance_amount?: number;
  start_time?: string;
  end_time?: string;
};

type UpdatePayload = Partial<CreatePayload>;

const toMaterial = (raw: RawMaterial) => ({
  id: String(raw.id),
  quantity: Number(raw.quantity || 0),
  material_type: {
    name: raw.material_name || "Tillägg",
    unit: raw.material_unit || "",
  },
});

const toTimeEntry = (raw: RawTimeEntry): TimeEntry => ({
  id: String(raw.id),
  user_id: String(raw.user_id),
  date: raw.datum || raw.date || "",
  start_time: raw.starttid || "",
  end_time: raw.sluttid || "",
  total_hours: raw.timmar != null ? Number(raw.timmar) : 0,
  project_id: raw.project_id != null ? String(raw.project_id) : "",
  subproject_id: raw.subproject_id != null ? String(raw.subproject_id) : null,
  job_role_id: raw.job_role_id != null ? String(raw.job_role_id) : null,
  work_description: raw.comment || "",
  status: raw.status || null,
  attested_by: raw.attested_by != null ? String(raw.attested_by) : null,
  attested_at: raw.attested_at || null,
  project: raw.project_name ? { name: raw.project_name } : undefined,
  subproject: raw.subproject_name ? { name: raw.subproject_name } : undefined,
  job_role: raw.job_role_name ? { name: raw.job_role_name } : undefined,
  material_reports: raw.materials ? raw.materials.map(toMaterial) : undefined,
});

export async function listTimeEntries(params: ListParams = {}) {
  const qs = new URLSearchParams();
  if (params.user_id) qs.set("user_id", String(params.user_id));
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.project_id) qs.set("project_id", String(params.project_id));
  if (params.status) qs.set("status", params.status);
  if (params.includeMaterials) qs.set("include_materials", "true");

  const data = await api.get<RawTimeEntry[]>(`/time-entries${qs.toString() ? `?${qs.toString()}` : ""}`);
  return (data || []).map(toTimeEntry);
}

export async function createTimeEntry(payload: CreatePayload) {
  const body: any = {
    user_id: payload.user_id,
    date: payload.date,
    hours: payload.hours,
    job_role_id: payload.job_role_id || null,
    project_id: payload.project_id || null,
    subproject_id: payload.subproject_id || null,
    description: payload.description || null,
    status: payload.status || undefined,
    allowance_type: payload.allowance_type,
    allowance_amount: payload.allowance_amount,
  };

  const raw = await api.post<RawTimeEntry>("/time-entries", body);
  return toTimeEntry({
    ...raw,
    starttid: payload.start_time ?? raw.starttid,
    sluttid: payload.end_time ?? raw.sluttid,
  });
}

export async function updateTimeEntry(id: string | number, payload: UpdatePayload) {
  const body: any = {
    date: payload.date,
    hours: payload.hours,
    job_role_id: payload.job_role_id || null,
    project_id: payload.project_id || null,
    subproject_id: payload.subproject_id || null,
    description: payload.description || null,
    status: payload.status || undefined,
    allowance_type: payload.allowance_type,
    allowance_amount: payload.allowance_amount,
  };

  const raw = await api.put<RawTimeEntry>(`/time-entries/${id}`, body);
  return toTimeEntry({
    ...raw,
    starttid: payload.start_time ?? raw.starttid,
    sluttid: payload.end_time ?? raw.sluttid,
  });
}

export async function deleteTimeEntry(id: string | number) {
  await api.del(`/time-entries/${id}`);
}

export async function addMaterialToTimeEntry(
  timeEntryId: string | number,
  payload: { material_type_id: string | number; quantity: number; place?: string }
) {
  const raw = await api.post<RawMaterial>(`/time-entries/${timeEntryId}/materials`, {
    material_type_id: payload.material_type_id,
    quantity: payload.quantity,
    place: payload.place,
  });
  return toMaterial(raw);
}
