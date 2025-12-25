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
  restid?: number | string | null;
  project_id?: number | string | null;
  subproject_id?: number | string | null;
  job_role_id?: number | string | null;
  shift_type?: string | null;
  break_minutes?: number | string | null;
  traktamente_type?: string | null;
  traktamente_amount?: number | string | null;
  deviation_title?: string | null;
  deviation_description?: string | null;
  deviation_status?: string | null;
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
  break_minutes: number;
  shift_type?: string | null;
  per_diem_type?: string | null;
  per_diem_amount?: number | null;
  deviation_title?: string | null;
  deviation_description?: string | null;
  deviation_status?: string | null;
  travel_time_hours?: number;
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
  break_minutes?: number;
  project_id?: string;
  subproject_id?: string;
  job_role_id?: string;
  description?: string;
  status?: string;
  allowance_type?: string;
  allowance_amount?: number;
  start_time?: string;
  end_time?: string;
  deviation_title?: string | null;
  deviation_description?: string | null;
  deviation_status?: string | null;
  travel_time_hours?: number;
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
  break_minutes: raw.break_minutes != null ? Number(raw.break_minutes) : 0,
  shift_type: raw.shift_type ?? null,
  per_diem_type: raw.traktamente_type ?? null,
  per_diem_amount: raw.traktamente_amount != null ? Number(raw.traktamente_amount) : null,
  deviation_title: raw.deviation_title ?? null,
  deviation_description: raw.deviation_description ?? null,
  deviation_status: raw.deviation_status ?? null,
  travel_time_hours: raw.restid != null ? Number(raw.restid) : 0,
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
    break_minutes: payload.break_minutes,
    start_time: payload.start_time,
    end_time: payload.end_time,
    job_role_id: payload.job_role_id || null,
    project_id: payload.project_id || null,
    subproject_id: payload.subproject_id || null,
    description: payload.description || null,
    status: payload.status || undefined,
    allowance_type: payload.allowance_type,
    allowance_amount: payload.allowance_amount,
    deviation_title: payload.deviation_title || null,
    deviation_description: payload.deviation_description || null,
    deviation_status: payload.deviation_status || null,
    travel_time_hours: payload.travel_time_hours ?? null,
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
    break_minutes: payload.break_minutes,
    start_time: payload.start_time,
    end_time: payload.end_time,
    job_role_id: payload.job_role_id || null,
    project_id: payload.project_id || null,
    subproject_id: payload.subproject_id || null,
    description: payload.description || null,
    status: payload.status || undefined,
    allowance_type: payload.allowance_type,
    allowance_amount: payload.allowance_amount,
    deviation_title: payload.deviation_title || null,
    deviation_description: payload.deviation_description || null,
    deviation_status: payload.deviation_status || null,
    travel_time_hours: payload.travel_time_hours ?? null,
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
