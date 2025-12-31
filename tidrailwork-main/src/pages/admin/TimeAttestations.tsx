import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { useAuth } from "@/contexts/AuthContext";
import { format, addWeeks, startOfWeek, getISOWeek, getISOWeekYear, isWithinInterval, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { CheckCircle, Lock, Unlock, Pencil, CheckCircle2, AlertCircle, Download, X, FileText } from "lucide-react";
import { calculateOBDistributionWithOvertime } from "@/lib/obDistribution";

const REST_OPTIONS = ["0", "15", "30", "45", "60"];

const DEFAULT_CUSTOMER_PDF_SETTINGS = {
  show_day: true,
  show_evening: true,
  show_night: true,
  show_weekend: true,
  show_overtime_weekday: true,
  show_overtime_weekend: true,
  day_start: "06:00",
  day_end: "18:00",
  evening_start: "18:00",
  evening_end: "21:00",
  night_start: "21:00",
  night_end: "06:00",
  weekend_start: "18:00",
  weekend_end: "06:00",
};

const normalizeCustomerPdfSettings = (raw?: Record<string, any>) => ({
  show_day: Boolean(raw?.show_day ?? DEFAULT_CUSTOMER_PDF_SETTINGS.show_day),
  show_evening: Boolean(raw?.show_evening ?? DEFAULT_CUSTOMER_PDF_SETTINGS.show_evening),
  show_night: Boolean(raw?.show_night ?? DEFAULT_CUSTOMER_PDF_SETTINGS.show_night),
  show_weekend: Boolean(raw?.show_weekend ?? DEFAULT_CUSTOMER_PDF_SETTINGS.show_weekend),
  show_overtime_weekday: Boolean(
    raw?.show_overtime_weekday ?? DEFAULT_CUSTOMER_PDF_SETTINGS.show_overtime_weekday
  ),
  show_overtime_weekend: Boolean(
    raw?.show_overtime_weekend ?? DEFAULT_CUSTOMER_PDF_SETTINGS.show_overtime_weekend
  ),
  day_start: raw?.day_start || DEFAULT_CUSTOMER_PDF_SETTINGS.day_start,
  day_end: raw?.day_end || DEFAULT_CUSTOMER_PDF_SETTINGS.day_end,
  evening_start: raw?.evening_start || DEFAULT_CUSTOMER_PDF_SETTINGS.evening_start,
  evening_end: raw?.evening_end || DEFAULT_CUSTOMER_PDF_SETTINGS.evening_end,
  night_start: raw?.night_start || DEFAULT_CUSTOMER_PDF_SETTINGS.night_start,
  night_end: raw?.night_end || DEFAULT_CUSTOMER_PDF_SETTINGS.night_end,
  weekend_start: raw?.weekend_start || DEFAULT_CUSTOMER_PDF_SETTINGS.weekend_start,
  weekend_end: raw?.weekend_end || DEFAULT_CUSTOMER_PDF_SETTINGS.weekend_end,
});

const timeToHours = (value: string, fallback: number) => {
  const match = String(value || "").match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours + minutes / 60;
};

type User = { id: string; full_name?: string; email?: string };
type Project = { id: string; name: string };
type Subproject = { id: string; name: string; project_id: string };
type JobRole = { id: string; name: string };
type Customer = { id: string; name: string };
type MaterialType = { id: string; name: string; unit?: string };

type TimeEntry = {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  break_minutes: number;
  project_id: string;
  subproject_id: string | null;
  job_role_id: string | null;
  work_description: string;
  status?: string | null;
  attested_by?: string | null;
  attested_at?: string | null;
  invoiced?: boolean;
  project?: { name: string };
  subproject?: { name: string };
  job_role?: { name: string };
  user_email?: string | null;
  user_full_name?: string | null;
  customer_name?: string | null;
  shift_type?: string | null;
  ao_number?: string | null;
  per_diem_type?: string | null;
  travel_time_hours?: number | null;
  save_travel_compensation?: boolean;
  overtime_weekday_hours?: number | null;
  overtime_weekend_hours?: number | null;
  save_comp_time?: boolean;
  comp_time_saved_hours?: number | null;
  comp_time_taken_hours?: number | null;
  deviation_title?: string | null;
  deviation_description?: string | null;
  deviation_status?: string | null;
  deviation_severity?: string | null;
  materials?: { id?: string | number; material_type_id: string | number; quantity: number; place?: string | null }[];
};

const statusBadge = (entry: TimeEntry) => {
  if (entry.attested_by) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
        <CheckCircle className="h-3 w-3 mr-1" />
        Attesterad
      </Badge>
    );
  }
  return <Badge variant="outline">{entry.status || "Ny"}</Badge>;
};

export default function TimeAttestations() {
  const { isAdmin, companyId } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedSubproject, setSelectedSubproject] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const [bulkAttesting, setBulkAttesting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCustomerPdf, setExportingCustomerPdf] = useState(false);

  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editSubprojectId, setEditSubprojectId] = useState("");
  const [editJobRoleId, setEditJobRoleId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editBreakMinutes, setEditBreakMinutes] = useState("0");
  const [editAoNumber, setEditAoNumber] = useState("");
  const [editPerDiem, setEditPerDiem] = useState("none");
  const [editTravelHours, setEditTravelHours] = useState("");
  const [editSaveTravelComp, setEditSaveTravelComp] = useState(false);
  const [editOvertimeWeekday, setEditOvertimeWeekday] = useState("0");
  const [editOvertimeWeekend, setEditOvertimeWeekend] = useState("0");
  const [editCompTimeAction, setEditCompTimeAction] = useState<"none" | "save" | "take">("none");
  const [editCompTimeHours, setEditCompTimeHours] = useState("0");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editMaterials, setEditMaterials] = useState<{ material_type_id: string; quantity: number; id?: string | number }[]>([]);
  const [selectedMaterialType, setSelectedMaterialType] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("0");
  const [editDeviationTitle, setEditDeviationTitle] = useState("");
  const [editDeviationDescription, setEditDeviationDescription] = useState("");
  const [editDeviationStatus, setEditDeviationStatus] = useState("none");

  useEffect(() => {
    if (!isAdmin || !companyId) return;
    loadLists();
    loadEntries();
  }, [isAdmin, companyId]);

  const loadLists = async () => {
    try {
      const [usersData, projectsData, subprojectsData, jobRolesData, customersData] = await Promise.all([
        apiFetch<User[]>(`/admin/users?company_id=${companyId}`),
        apiFetch<Project[]>(`/projects?active=true`),
        apiFetch<Subproject[]>(`/subprojects?active=true`),
        apiFetch<JobRole[]>(`/job-roles?active=true`),
        apiFetch<Customer[]>(`/customers`),
      ]);
      setUsers(
        ensureArray(usersData).map((u: any) => ({
          ...u,
          id: String(u.id),
          full_name: u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.id,
        }))
      );
      const projectsArray = ensureArray(projectsData);
      const subprojectsArray = ensureArray(subprojectsData);
      const jobRolesArray = ensureArray(jobRolesData);
      const customersArray = ensureArray(customersData);

      setProjects(projectsArray.map((p: any) => ({ ...p, id: String(p.id) })));
      setSubprojects(subprojectsArray.map((sp: any) => ({ ...sp, id: String(sp.id), project_id: String(sp.project_id) })));
      setJobRoles(jobRolesArray.map((j: any) => ({ ...j, id: String(j.id) })));
      setCustomers(customersArray.map((c: any) => ({ ...c, id: String(c.id) })));

      const materialTypesData = await apiFetch<MaterialType[]>(`/material-types?active=true`);
      const materialTypesArray: MaterialType[] = ensureArray(materialTypesData);
      setMaterialTypes(materialTypesArray.map((m) => ({ ...m, id: String(m.id) })));
    } catch (e: any) {
      toast.error(e.message || "Kunde inte hämta listor");
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const qs = companyId ? `?include_materials=true&company_id=${companyId}` : "?include_materials=true";
      const data = await apiFetch<any[]>(`/time-entries${qs}`);
      const normalized = ensureArray(data).map((e) => ({
        id: String(e.id),
        user_id: String(e.user_id),
        date: e.datum || e.date || "",
        start_time: e.starttid && e.starttid !== "null" ? e.starttid : e.start_time || "",
        end_time: e.sluttid && e.sluttid !== "null" ? e.sluttid : e.end_time || "",
        total_hours: e.timmar != null ? Number(e.timmar) : Number(e.total_hours) || 0,
        break_minutes: e.break_minutes != null ? Number(e.break_minutes) : 0,
        project_id: e.project_id != null ? String(e.project_id) : "",
        subproject_id: e.subproject_id != null ? String(e.subproject_id) : null,
        job_role_id: e.job_role_id != null ? String(e.job_role_id) : null,
        work_description: e.comment || e.work_description || "",
        status: e.status || null,
        attested_by: e.attested_by != null ? String(e.attested_by) : null,
        attested_at: e.attested_at || null,
        project: e.project_name
          ? { name: e.project_name, customer_id: e.customer_id, customer_name: e.customer_name }
          : e.project,
        subproject: e.subproject_name ? { name: e.subproject_name } : e.subproject,
        job_role: e.job_role_name ? { name: e.job_role_name } : e.job_role,
        user_email: e.user_email || null,
        user_full_name: e.user_full_name || e.user_name || null,
        invoiced: e.invoiced ?? false,
        customer_name: e.customer_name || null,
        shift_type: e.shift_type || null,
        ao_number: e.ao_number || null,
        per_diem_type: e.traktamente_type || e.per_diem_type || null,
        travel_time_hours: e.restid != null ? Number(e.restid) : e.travel_time_hours ?? null,
        save_travel_compensation: e.save_travel_compensation ?? false,
        overtime_weekday_hours: e.overtime_weekday_hours ?? null,
        overtime_weekend_hours: e.overtime_weekend_hours ?? null,
        save_comp_time: e.save_comp_time ?? false,
        comp_time_saved_hours: e.comp_time_saved_hours ?? 0,
        comp_time_taken_hours: e.comp_time_taken_hours ?? 0,
        deviation_title: e.deviation_title || null,
        deviation_description: e.deviation_description || null,
        deviation_status: e.deviation_status || null,
        deviation_severity: e.deviation_severity || null,
        materials: (e.materials || []).map((m: any) => ({
          id: m.id,
          material_type_id: String(m.material_type_id),
          quantity: m.quantity,
          place: m.place || null,
        })),
      })) as TimeEntry[];
      setEntries(normalized);
    } catch (e: any) {
      toast.error(e.message || "Kunde inte hämta tidrapporter");
    } finally {
      setLoading(false);
    }
  };

  const filteredSubprojects = useMemo(() => {
    if (selectedProject === "all") return subprojects;
    return subprojects.filter((s) => s.project_id === selectedProject);
  }, [subprojects, selectedProject]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedUser !== "all" && e.user_id !== selectedUser) return false;
      if (selectedStatus === "attested" && !e.attested_by) return false;
      if (selectedStatus === "not_attested" && e.attested_by) return false;
      if (selectedInvoiceStatus === "invoiced" && !e.invoiced) return false;
      if (selectedInvoiceStatus === "not_invoiced" && e.invoiced) return false;
      if (selectedProject !== "all" && e.project_id !== selectedProject) return false;
      if (selectedSubproject !== "all" && e.subproject_id !== selectedSubproject) return false;
      if (selectedCustomer !== "all") {
        const match = e.project && (e.project as any).customer_id
          ? String((e.project as any).customer_id) === selectedCustomer
          : e.customer_name && customers.find((c) => c.id === selectedCustomer)?.name === e.customer_name;
        if (!match) return false;
      }

      const d = e.date ? new Date(e.date) : null;
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      if (selectedWeek !== "all" && d && !Number.isNaN(d.getTime())) {
        const wk = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
        if (wk !== selectedWeek) return false;
      }
      if (d && !Number.isNaN(d.getTime())) {
        if (from && !Number.isNaN(from.getTime()) && d < from) return false;
        if (to && !Number.isNaN(to.getTime()) && d > to) return false;
      }

      return true;
    });
  }, [entries, selectedUser, selectedStatus, selectedProject, selectedSubproject, fromDate, toDate, selectedWeek, selectedCustomer, selectedInvoiceStatus, customers]);

  const pendingFilteredCount = useMemo(
    () => filteredEntries.filter((entry) => !entry.attested_by).length,
    [filteredEntries]
  );

  const attestEntry = async (id: string, approved: boolean) => {
    try {
      await apiFetch(`/time-entries/${id}/attest`, { method: "POST", json: { approved } });
      toast.success(approved ? "Attesterad" : "Låst upp");
      loadEntries();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte uppdatera attest");
    }
  };

  const attestAllFiltered = async () => {
    const pendingEntries = filteredEntries.filter((entry) => !entry.attested_by);
    if (pendingEntries.length === 0) {
      toast.error("Inga ej attesterade tidrapporter i urvalet");
      return;
    }
    setBulkAttesting(true);
    try {
      const results = await Promise.allSettled(
        pendingEntries.map((entry) =>
          apiFetch(`/time-entries/${entry.id}/attest`, { method: "POST", json: { approved: true } })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        toast.error(`Kunde inte attestera ${failed.length} av ${results.length} tidrapporter`);
      } else {
        toast.success(`Attesterade ${results.length} tidrapporter`);
      }
      loadEntries();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte attestera tidrapporter");
    } finally {
      setBulkAttesting(false);
    }
  };

  const exportToPDF = async () => {
    if (filteredEntries.length === 0) {
      toast.error("Inga tidrapporter att exportera");
      return;
    }
    setExportingPdf(true);
    try {
      const doc = new jsPDF();

      const uniqueUsers = Array.from(
        new Set(
          filteredEntries.map((entry) =>
            userLabel(entry.user_id, entry.user_full_name || entry.user_email || entry.user_id)
          )
        )
      );
      const reportUserName =
        selectedUser !== "all"
          ? userLabel(selectedUser)
          : uniqueUsers.length === 1
          ? uniqueUsers[0]
          : "Alla";

      const getValidDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const entryDates = filteredEntries
        .map((entry) => getValidDate(entry.date))
        .filter(Boolean) as Date[];
      const minDate = entryDates.length ? new Date(Math.min(...entryDates.map((d) => d.getTime()))) : null;
      const maxDate = entryDates.length ? new Date(Math.max(...entryDates.map((d) => d.getTime()))) : null;
      const periodStart = getValidDate(fromDate) || minDate;
      const periodEnd = getValidDate(toDate) || maxDate;
      const formatPeriodDate = (value: Date | null) =>
        value ? format(value, "d MMM yyyy", { locale: sv }) : "-";
      let periodLabel = "-";
      if (periodStart && periodEnd) {
        periodLabel = `${formatPeriodDate(periodStart)} - ${formatPeriodDate(periodEnd)}`;
      } else if (periodStart) {
        periodLabel = formatPeriodDate(periodStart);
      }

      doc.setFontSize(20);
      doc.text("Tidrapport - Sammanställning", 14, 20);
      doc.setFontSize(12);
      doc.text(`Anställd: ${reportUserName}`, 14, 30);
      doc.text(`Exportdatum: ${format(new Date(), "d MMMM yyyy", { locale: sv })}`, 14, 37);
      doc.text(`Period: ${periodLabel}`, 14, 44);

      const sortedEntries = [...filteredEntries].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      let totalHours = 0;
      let totalDay = 0;
      let totalEvening = 0;
      let totalNight = 0;
      let totalWeekend = 0;
      let totalTravel = 0;
      let totalPerDiemDays = 0;

      const tableRows = sortedEntries.map((entry) => {
        const obDist =
          entry.date && entry.start_time && entry.end_time
            ? calculateOBDistributionWithOvertime(
                entry.date,
                entry.start_time,
                entry.end_time,
                entry.break_minutes || 0,
                entry.overtime_weekday_hours,
                entry.overtime_weekend_hours
              )
            : { day: 0, evening: 0, night: 0, weekend: 0 };

        totalHours += entry.total_hours || 0;
        totalDay += obDist.day;
        totalEvening += obDist.evening;
        totalNight += obDist.night;
        totalWeekend += obDist.weekend;

        const travelHours = Number(entry.travel_time_hours || 0);
        totalTravel += travelHours;

        const perDiemDays =
          entry.per_diem_type === "full" ? 1 : entry.per_diem_type === "half" ? 0.5 : 0;
        totalPerDiemDays += perDiemDays;

        const traktLabel =
          entry.per_diem_type === "full"
            ? "Hel"
            : entry.per_diem_type === "half"
            ? "Halv"
            : "-";

        const deviationFlag =
          entry.deviation_title || entry.deviation_description || entry.deviation_status ? "Ja" : "-";

        const timeRange =
          entry.start_time && entry.end_time ? `${entry.start_time} - ${entry.end_time}` : "-";

        return [
          entry.date ? format(new Date(entry.date), "yyyy-MM-dd") : "-",
          entry.project?.name || "-",
          entry.subproject?.name || "-",
          timeRange,
          String(entry.break_minutes ?? 0),
          (entry.total_hours || 0).toFixed(2),
          obDist.day.toFixed(2),
          obDist.evening.toFixed(2),
          obDist.night.toFixed(2),
          obDist.weekend.toFixed(2),
          travelHours > 0 ? travelHours.toFixed(2) : "-",
          traktLabel,
          entry.work_description || "-",
          deviationFlag,
        ];
      });

      autoTable(doc, {
        startY: 54,
        head: [[
          "Datum",
          "Projekt",
          "Under-\nprojekt",
          "Tid",
          "Rast\n(min)",
          "Tot\n(h)",
          "Dag\n(h)",
          "Kväll\n(h)",
          "Natt\n(h)",
          "Helg\n(h)",
          "Restid\n(h)",
          "Trakt.",
          "Beskrivning",
          "Avv.",
        ]],
        body: tableRows,
        styles: { fontSize: 7, cellPadding: 1.5, valign: "middle" },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: "center" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 18, halign: "left" },
          2: { cellWidth: 18, halign: "left" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 8, halign: "center" },
          5: { cellWidth: 8, halign: "center" },
          6: { cellWidth: 8, halign: "center" },
          7: { cellWidth: 8, halign: "center" },
          8: { cellWidth: 8, halign: "center" },
          9: { cellWidth: 8, halign: "center" },
          10: { cellWidth: 8, halign: "center" },
          11: { cellWidth: 8, halign: "center" },
          12: { cellWidth: 30, halign: "left" },
          13: { cellWidth: 6, halign: "center" },
        },
      });

      const afterTableY = (doc as any).lastAutoTable?.finalY || 60;
      doc.setFontSize(14);
      doc.text("Sammanfattning", 14, afterTableY + 8);

      const formatDays = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

      autoTable(doc, {
        startY: afterTableY + 12,
        head: [["Kategori", "Värde"]],
        body: [
          ["Totalt arbetstid", `${totalHours.toFixed(2)} h`],
          ["Dagtid (07:00-18:00 Mån-Fre)", `${totalDay.toFixed(2)} h`],
          ["Kvällstid (18:00-21:00 Mån-Tor)", `${totalEvening.toFixed(2)} h`],
          ["Nattetid (21:00-06:00 Mån-Tor)", `${totalNight.toFixed(2)} h`],
          ["Helgtid (18:00 Fre - 07:00 Mån)", `${totalWeekend.toFixed(2)} h`],
          ["Restid", `${totalTravel.toFixed(2)} h`],
          ["Traktamente", `${formatDays(totalPerDiemDays)} dagar`],
        ],
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [52, 152, 219], textColor: 255 },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 40, halign: "right" },
        },
      });

      const deviations = sortedEntries
        .filter((entry) => entry.deviation_title || entry.deviation_description || entry.deviation_status)
        .map((entry) => ({
          date: entry.date ? format(new Date(entry.date), "yyyy-MM-dd") : "-",
          title: entry.deviation_title || "-",
          description: entry.deviation_description || "-",
          severity: entry.deviation_severity || "-",
          status: entry.deviation_status || "-",
        }));

      if (deviations.length > 0) {
        const afterSummaryY = (doc as any).lastAutoTable?.finalY || afterTableY + 40;
        doc.setFontSize(14);
        doc.text("Avvikelser", 14, afterSummaryY + 10);

        autoTable(doc, {
          startY: afterSummaryY + 14,
          head: [["Datum", "Titel", "Beskrivning", "Allvarlighetsgrad", "Status"]],
          body: deviations.map((d) => [d.date, d.title, d.description, d.severity, d.status]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [231, 76, 60], textColor: 255 },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 30 },
            2: { cellWidth: 60 },
            3: { cellWidth: 35 },
            4: { cellWidth: 25 },
          },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Sida ${i} av ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      const safeName = reportUserName.replace(/[^a-zA-Z0-9_-]+/g, "_");
      const fileName = `Tidrapport_${safeName}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);
      toast.success("PDF genererad!");
    } catch (error: any) {
      console.error("PDF error:", error);
      toast.error("Kunde inte generera PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const exportCustomerPdf = async () => {
    if (filteredEntries.length === 0) {
      toast.error("Inga tidrapporter att exportera");
      return;
    }
    setExportingCustomerPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });

      const customerName =
        selectedCustomer !== "all"
          ? customers.find((c) => c.id === selectedCustomer)?.name || "-"
          : "Alla kunder";
      const projectName =
        selectedProject !== "all"
          ? projects.find((p) => p.id === selectedProject)?.name || "-"
          : "Alla projekt";
      const subprojectName =
        selectedSubproject !== "all"
          ? subprojects.find((s) => s.id === selectedSubproject)?.name || "-"
          : "Alla underprojekt";
      const userName = selectedUser !== "all" ? userLabel(selectedUser) : "Alla användare";
      const statusLabel =
        selectedStatus === "attested"
          ? "Attesterade"
          : selectedStatus === "not_attested"
          ? "Ej attesterade"
          : "Alla";
      const invoiceLabel =
        selectedInvoiceStatus === "invoiced"
          ? "Fakturerade"
          : selectedInvoiceStatus === "not_invoiced"
          ? "Ej fakturerade"
          : "Alla";

      const getValidDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const entryDates = filteredEntries
        .map((entry) => getValidDate(entry.date))
        .filter(Boolean) as Date[];
      const minDate = entryDates.length ? new Date(Math.min(...entryDates.map((d) => d.getTime()))) : null;
      const maxDate = entryDates.length ? new Date(Math.max(...entryDates.map((d) => d.getTime()))) : null;
      const periodStart = getValidDate(fromDate) || minDate;
      const periodEnd = getValidDate(toDate) || maxDate;
      const formatPeriodDate = (value: Date | null) =>
        value ? format(value, "d MMM yyyy", { locale: sv }) : "-";
      let periodLabel = "-";
      if (periodStart && periodEnd) {
        periodLabel = `${formatPeriodDate(periodStart)} - ${formatPeriodDate(periodEnd)}`;
      } else if (periodStart) {
        periodLabel = formatPeriodDate(periodStart);
      }

      let settings = DEFAULT_CUSTOMER_PDF_SETTINGS;
      try {
        const settingsYear = (periodStart || minDate || new Date()).getFullYear();
        const params = new URLSearchParams({ year: String(settingsYear) });
        if (selectedProject !== "all") params.set("project_id", selectedProject);
        const data = await apiFetch<any>(`/price-list?${params.toString()}`);
        settings = normalizeCustomerPdfSettings(data?.settings);
      } catch (error) {
        console.warn("Kunde inte hämta prislista-inställningar:", error);
      }

      const showDay = settings.show_day;
      const showEvening = settings.show_evening;
      const showNight = settings.show_night;
      const showWeekend = settings.show_weekend;
      const showOtWeekday = settings.show_overtime_weekday;
      const showOtWeekend = settings.show_overtime_weekend;

      const shiftWindows = {
        day: {
          start: timeToHours(settings.day_start, 6),
          end: timeToHours(settings.day_end, 18),
        },
        evening: {
          start: timeToHours(settings.evening_start, 18),
          end: timeToHours(settings.evening_end, 21),
        },
        night: {
          start: timeToHours(settings.night_start, 21),
          end: timeToHours(settings.night_end, 6),
        },
        weekend: {
          start: timeToHours(settings.weekend_start, 18),
          end: timeToHours(settings.weekend_end, 6),
        },
      };

      doc.setFontSize(20);
      doc.text("Kundunderlag", 14, 18);
      doc.setFontSize(11);
      doc.text(`Kund: ${customerName}`, 14, 26);
      doc.text(`Projekt: ${projectName}`, 14, 32);
      doc.text(`Underprojekt: ${subprojectName}`, 14, 38);
      doc.text(`Användare: ${userName}`, 14, 44);
      doc.text(`Atteststatus: ${statusLabel}`, 14, 50);
      doc.text(`Fakturering: ${invoiceLabel}`, 14, 56);
      doc.text(`Period: ${periodLabel}`, 14, 62);
      doc.text(`Exportdatum: ${format(new Date(), "d MMMM yyyy", { locale: sv })}`, 14, 68);

      const sortedEntries = [...filteredEntries].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      let totalHours = 0;
      let totalDay = 0;
      let totalEvening = 0;
      let totalNight = 0;
      let totalWeekend = 0;
      let totalTravel = 0;
      let totalOvertimeWeekday = 0;
      let totalOvertimeWeekend = 0;
      let totalPerDiemDays = 0;

      const materialTotals = new Map<string, { name: string; unit: string; total: number }>();

      const columns: { key: string; label: string }[] = [
        { key: "date", label: "Datum" },
        { key: "user", label: "Anställd" },
        { key: "project", label: "Projekt" },
        { key: "subproject", label: "Underprojekt" },
        { key: "jobrole", label: "Yrkesroll" },
        { key: "time", label: "Tid" },
        { key: "break", label: "Rast" },
        { key: "total", label: "Timmar" },
      ];

      if (showDay) columns.push({ key: "day", label: "Dag" });
      if (showEvening) columns.push({ key: "evening", label: "Kväll" });
      if (showNight) columns.push({ key: "night", label: "Natt" });
      if (showWeekend) columns.push({ key: "weekend", label: "Helg" });
      if (showOtWeekday) columns.push({ key: "ot_weekday", label: "ÖT vardag" });
      if (showOtWeekend) columns.push({ key: "ot_weekend", label: "ÖT helg" });

      columns.push({ key: "travel", label: "Restid" });
      columns.push({ key: "per_diem", label: "Trakt." });
      columns.push({ key: "materials", label: "Tillägg" });
      columns.push({ key: "comment", label: "Kommentar" });

      const entriesTable = sortedEntries.map((entry) => {
        totalHours += entry.total_hours || 0;
        totalTravel += Number(entry.travel_time_hours || 0);
        totalOvertimeWeekday += Number(entry.overtime_weekday_hours || 0);
        totalOvertimeWeekend += Number(entry.overtime_weekend_hours || 0);

        const perDiemDays =
          entry.per_diem_type === "full" ? 1 : entry.per_diem_type === "half" ? 0.5 : 0;
        totalPerDiemDays += perDiemDays;

        const jobRoleName =
          entry.job_role?.name || jobRoles.find((role) => role.id === entry.job_role_id)?.name || "-";
        const timeRange =
          entry.start_time && entry.end_time ? `${entry.start_time} - ${entry.end_time}` : "-";

        const materialSummary = (entry.materials || [])
          .map((m) => {
            const mt = materialTypes.find((t) => t.id === String(m.material_type_id));
            const unit = mt?.unit ? ` ${mt.unit}` : "";
            if (m.quantity != null) {
              const current = materialTotals.get(String(m.material_type_id));
              const nextTotal = (current?.total || 0) + Number(m.quantity || 0);
              materialTotals.set(String(m.material_type_id), {
                name: mt?.name || String(m.material_type_id),
                unit: mt?.unit || "",
                total: nextTotal,
              });
            }
            return `${mt?.name || m.material_type_id}: ${m.quantity}${unit}`;
          })
          .join(", ");

        const perDiemLabel =
          entry.per_diem_type === "full"
            ? "Hel"
            : entry.per_diem_type === "half"
            ? "Halv"
            : "-";

        let obDist = { day: 0, evening: 0, night: 0, weekend: 0 };
        if (showDay || showEvening || showNight || showWeekend) {
          obDist =
            entry.date && entry.start_time && entry.end_time
              ? calculateOBDistributionWithOvertime(
                  entry.date,
                  entry.start_time,
                  entry.end_time,
                  entry.break_minutes || 0,
                  entry.overtime_weekday_hours,
                  entry.overtime_weekend_hours,
                  shiftWindows
                )
              : { day: 0, evening: 0, night: 0, weekend: 0 };
        }

        totalDay += obDist.day;
        totalEvening += obDist.evening;
        totalNight += obDist.night;
        totalWeekend += obDist.weekend;

        const row: Record<string, string> = {
          date: entry.date ? format(new Date(entry.date), "yyyy-MM-dd") : "-",
          user: userLabel(entry.user_id, entry.user_full_name || entry.user_email || entry.user_id),
          project: entry.project?.name || "-",
          subproject: entry.subproject?.name || "-",
          jobrole: jobRoleName,
          time: timeRange,
          break: String(entry.break_minutes ?? 0),
          total: (entry.total_hours || 0).toFixed(2),
          day: obDist.day.toFixed(2),
          evening: obDist.evening.toFixed(2),
          night: obDist.night.toFixed(2),
          weekend: obDist.weekend.toFixed(2),
          ot_weekday: Number(entry.overtime_weekday_hours || 0).toFixed(2),
          ot_weekend: Number(entry.overtime_weekend_hours || 0).toFixed(2),
          travel: Number(entry.travel_time_hours || 0).toFixed(2),
          per_diem: perDiemLabel,
          materials: materialSummary || "-",
          comment: entry.work_description || "-",
        };

        return columns.map((col) => row[col.key] ?? "-");
      });

      doc.setFontSize(14);
      doc.text("Rapporterade tider", 14, 78);

      autoTable(doc, {
        startY: 82,
        head: [columns.map((col) => col.label)],
        body: entriesTable,
        styles: { fontSize: 6.5, cellPadding: 1.4, valign: "middle" },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
      });

      let cursorY = (doc as any).lastAutoTable?.finalY + 10;

      doc.setFontSize(14);
      doc.text("Sammanställning", 14, cursorY);
      cursorY += 4;

      const summaryRows = [
        ["Antal tidrapporter", String(filteredEntries.length)],
        ["Totala timmar", `${totalHours.toFixed(2)} h`],
      ];
      if (showDay) summaryRows.push(["Dag", `${totalDay.toFixed(2)} h`]);
      if (showEvening) summaryRows.push(["Kväll", `${totalEvening.toFixed(2)} h`]);
      if (showNight) summaryRows.push(["Natt", `${totalNight.toFixed(2)} h`]);
      if (showWeekend) summaryRows.push(["Helg", `${totalWeekend.toFixed(2)} h`]);
      summaryRows.push(["Restid", `${totalTravel.toFixed(2)} h`]);
      if (showOtWeekday) summaryRows.push(["Övertid vardag", `${totalOvertimeWeekday.toFixed(2)} h`]);
      if (showOtWeekend) summaryRows.push(["Övertid helg", `${totalOvertimeWeekend.toFixed(2)} h`]);
      summaryRows.push(["Traktamente", `${totalPerDiemDays.toFixed(1)} dagar`]);

      autoTable(doc, {
        startY: cursorY,
        head: [["Kategori", "Värde"]],
        body: summaryRows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [52, 152, 219], textColor: 255 },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30, halign: "right" },
        },
      });

      cursorY = (doc as any).lastAutoTable?.finalY + 10;

      if (materialTotals.size > 0) {
        doc.setFontSize(14);
        doc.text("Tillägg", 14, cursorY);
        cursorY += 4;

        const materialRows = Array.from(materialTotals.values()).map((item) => [
          item.name,
          item.total.toFixed(2),
          item.unit || "-",
        ]);

        autoTable(doc, {
          startY: cursorY,
          head: [["Tillägg", "Antal", "Enhet"]],
          body: materialRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [46, 204, 113], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 20, halign: "right" },
            2: { cellWidth: 20 },
          },
        });

        cursorY = (doc as any).lastAutoTable?.finalY + 10;
      }

      const deviations = sortedEntries.filter(
        (entry) => entry.deviation_title || entry.deviation_description || entry.deviation_status
      );

      if (deviations.length > 0) {
        doc.setFontSize(14);
        doc.text("Avvikelser", 14, cursorY);
        cursorY += 4;

        autoTable(doc, {
          startY: cursorY,
          head: [["Rapport ID", "Datum", "Anställd", "Projekt", "Titel", "Beskrivning", "Status"]],
          body: deviations.map((entry) => [
            entry.id,
            entry.date ? format(new Date(entry.date), "yyyy-MM-dd") : "-",
            userLabel(entry.user_id, entry.user_full_name || entry.user_email || entry.user_id),
            entry.project?.name || "-",
            entry.deviation_title || "-",
            entry.deviation_description || "-",
            entry.deviation_status || "-",
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [231, 76, 60], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 22 },
            2: { cellWidth: 30 },
            3: { cellWidth: 30 },
            4: { cellWidth: 35 },
            5: { cellWidth: 70 },
            6: { cellWidth: 20 },
          },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Sida ${i} av ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      const safeName = projectName.replace(/[^a-zA-Z0-9_-]+/g, "_");
      doc.save(`kundunderlag_${safeName || "alla"}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("Kunde inte skapa PDF");
    } finally {
      setExportingCustomerPdf(false);
    }
  };

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    setEditDescription(entry.work_description || "");
    setEditProjectId(entry.project_id || "");
    setEditSubprojectId(entry.subproject_id || "");
    setEditJobRoleId(entry.job_role_id || "");
    setEditDate(entry.date || "");
    setEditStartTime(entry.start_time || "");
    setEditEndTime(entry.end_time || "");
    setEditBreakMinutes(String(entry.break_minutes ?? 0));
    setEditAoNumber((entry as any).ao_number || "");
    setEditPerDiem((entry as any).per_diem_type || "none");
    setEditTravelHours(String((entry as any).travel_time_hours ?? ""));
    setEditSaveTravelComp(Boolean((entry as any).save_travel_compensation));
    setEditOvertimeWeekday(String((entry as any).overtime_weekday_hours ?? "0"));
    setEditOvertimeWeekend(String((entry as any).overtime_weekend_hours ?? "0"));
    if ((entry.comp_time_taken_hours || 0) > 0) {
      setEditCompTimeAction("take");
      setEditCompTimeHours(entry.comp_time_taken_hours?.toString() || "0");
    } else if ((entry.comp_time_saved_hours || 0) > 0 || entry.save_comp_time) {
      const fallbackSaved =
        (entry.comp_time_saved_hours || 0) > 0
          ? entry.comp_time_saved_hours
          : (entry.overtime_weekday_hours || 0) + (entry.overtime_weekend_hours || 0);
      setEditCompTimeAction("save");
      setEditCompTimeHours(fallbackSaved.toString());
    } else {
      setEditCompTimeAction("none");
      setEditCompTimeHours("0");
    }
    setEditMaterials(
      (entry.materials || []).map((m) => ({
        id: m.id,
        material_type_id: String(m.material_type_id),
        quantity: Number(m.quantity) || 0,
      }))
    );
    setSelectedMaterialType("");
    setMaterialQuantity("0");
    setEditDeviationTitle(entry.deviation_title || "");
    setEditDeviationDescription(entry.deviation_description || "");
    setEditDeviationStatus(entry.deviation_status || "none");
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    try {
      const compTimeHoursValue = Number(editCompTimeHours) || 0;
      const saveCompTime = editCompTimeAction === "save" && compTimeHoursValue > 0;
      const compTimeSavedValue = editCompTimeAction === "save" ? compTimeHoursValue : 0;
      const compTimeTakenValue = editCompTimeAction === "take" ? compTimeHoursValue : 0;
      await apiFetch(`/time-entries/${editEntry.id}`, {
        method: "PUT",
        json: {
          date: editDate || editEntry.date || undefined,
          start_time: editStartTime || null,
          end_time: editEndTime || null,
          break_minutes: Number(editBreakMinutes) || 0,
          description: editDescription,
          project_id: editProjectId || null,
          subproject_id: editSubprojectId || null,
          job_role_id: editJobRoleId || null,
          ao_number: editAoNumber || null,
          allowance_type: editPerDiem || "none",
          allowance_amount:
            editPerDiem === "half" ? 145 : editPerDiem === "full" ? 290 : 0,
          travel_time_hours: editTravelHours ? Number(editTravelHours) : 0,
          save_travel_compensation: editSaveTravelComp,
          overtime_weekday_hours: editOvertimeWeekday ? Number(editOvertimeWeekday) : 0,
          overtime_weekend_hours: editOvertimeWeekend ? Number(editOvertimeWeekend) : 0,
          save_comp_time: saveCompTime,
          comp_time_saved_hours: compTimeSavedValue,
          comp_time_taken_hours: compTimeTakenValue,
          materials: editMaterials.map((m) => ({
            material_type_id: m.material_type_id,
            quantity: m.quantity,
            id: m.id,
          })),
          deviation_title: editDeviationTitle || null,
          deviation_description: editDeviationDescription || null,
          deviation_status: editDeviationStatus === "none" ? null : editDeviationStatus,
        },
      });
      toast.success("Uppdaterad");
      setEditEntry(null);
      loadEntries();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte spara");
    }
  };

  const deleteEntry = async () => {
    if (!editEntry) return;
    setShowDeleteConfirm(false);
    try {
      await apiFetch(`/time-entries/${editEntry.id}`, { method: "DELETE" });
      toast.success("Tidrapport borttagen");
      setEditEntry(null);
      loadEntries();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte ta bort tidrapport");
    }
  };

  const subprojectsForProject = useMemo(
    () => subprojects.filter((s) => !editProjectId || s.project_id === editProjectId),
    [subprojects, editProjectId]
  );

  const weeksOverview = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(addWeeks(today, -3), { weekStartsOn: 1 });
    const end = addWeeks(start, 4);
    const inRange = entries.filter((e) => {
      const d = e.date ? new Date(e.date) : null;
      return d && isWithinInterval(d, { start, end });
    });

    const grouped = new Map<
      string,
      { label: string; attested: number; total: number; invoiced: number; week: number; year: number }
    >();

    inRange.forEach((e) => {
      const d = e.date ? parseISO(e.date) : new Date(e.date || "");
      const wk = getISOWeek(d);
      const yr = getISOWeekYear(d);
      const key = `${yr}-W${String(wk).padStart(2, "0")}`;
      const label = `Vecka ${wk}`;
      if (!grouped.has(key)) grouped.set(key, { label, attested: 0, total: 0, invoiced: 0, week: wk, year: yr });
      const g = grouped.get(key)!;
      g.total += 1;
      if (e.attested_by) g.attested += 1;
      if (e.invoiced) g.invoiced += 1;
    });

    return Array.from(grouped.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const pendingByWeek = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(addWeeks(today, -3), { weekStartsOn: 1 });
    const end = addWeeks(start, 4);
    const inRange = entries.filter((e) => {
      const d = e.date ? new Date(e.date) : null;
      return d && isWithinInterval(d, { start, end });
    });

    const grouped = new Map<
      string,
      { label: string; users: Map<string, { name: string; count: number }>; week: number; year: number; total: number; attested: number }
    >();

    inRange.forEach((e) => {
      const d = e.date ? new Date(e.date) : null;
      if (!d) return;
      const wk = getISOWeek(d);
      const yr = getISOWeekYear(d);
      const key = `${yr}-W${String(wk).padStart(2, "0")}`;
      const label = `Vecka ${wk}`;
      if (!grouped.has(key)) grouped.set(key, { label, users: new Map(), week: wk, year: yr, total: 0, attested: 0 });
      const g = grouped.get(key)!;
      g.total += 1;
      if (e.attested_by) {
        g.attested += 1;
      } else {
        const name =
          e.user_full_name ||
          users.find((u) => u.id === e.user_id)?.full_name ||
          e.user_email ||
          e.user_id;
        const keyUser = e.user_id;
        const existing = g.users.get(keyUser);
        if (existing) {
          existing.count += 1;
        } else {
          g.users.set(keyUser, { name, count: 1 });
        }
      }
    });

    return Array.from(grouped.entries())
      .filter(([, g]) => g.total > g.attested) // only weeks with pending
      .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries, users]);

  const weekOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      const d = e.date ? new Date(e.date) : null;
      if (d && !Number.isNaN(d.getTime())) {
        const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
        set.add(key);
      }
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [entries]);

  const userLabel = (id: string, fallback?: string | null) => {
    return (
      users.find((u) => u.id === id)?.full_name ||
      fallback ||
      id
    );
  };

  const jumpToUser = (userId: string) => {
    setSelectedUser(userId);
    // Scroll to filter section so admin ser att filtrering aktiverats
    if (filterRef.current) {
      filterRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-3xl font-bold font-heading">Attestering</h2>
          <p className="text-muted-foreground">Granska och attestera tidrapporter för företaget.</p>
        </div>
      </div>

      {/* Klart för fakturering */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Klart för fakturering</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {weeksOverview.slice(0, 4).map(([key, data]) => {
              const ready = data.attested === data.total && data.total > 0;
              const color = ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50";
              return (
                <Card key={key} className={`shadow-card ${color}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {ready ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      {data.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <div>{data.attested}/{data.total} attesterade</div>
                    <div>{data.invoiced}/{data.total} fakturerade</div>
                  </CardContent>
                </Card>
              );
            })}
            {weeksOverview.length === 0 && (
              <Card>
                <CardContent className="py-4 text-sm text-muted-foreground">Inga rapporter senaste veckorna.</CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Oattesterade senaste veckorna */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Oattesterade tidrapporter (senaste 4 veckorna)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingByWeek.length === 0 && (
            <div className="text-sm text-muted-foreground">Alla tidrapporter är attesterade för de senaste veckorna.</div>
          )}
          {pendingByWeek.map(([key, data]) => (
            <Card key={key} className="border border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  {data.label} <Badge variant="outline" className="border-orange-300 text-orange-700">{data.total - data.attested} rapporter</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from(data.users.entries()).map(([userId, info]) => (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="bg-white text-orange-700 border-orange-200 cursor-pointer hover:bg-orange-100"
                    onClick={() => jumpToUser(userId)}
                  >
                    {userLabel(userId, info.name)} · {info.count}
                  </Badge>
                ))}
                {data.users.size === 0 && (
                  <p className="text-sm text-muted-foreground">Inga oattesterade rapporter denna vecka.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6" ref={filterRef}>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Användare</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla användare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla användare</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || u.email || u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Projekt</Label>
            <Select
              value={selectedProject}
              onValueChange={(v) => {
                setSelectedProject(v);
                setSelectedSubproject("all");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla projekt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla projekt</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Underprojekt</Label>
            <Select value={selectedSubproject} onValueChange={setSelectedSubproject}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla underprojekt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla underprojekt</SelectItem>
                {filteredSubprojects.map((sp) => (
                  <SelectItem key={sp.id} value={String(sp.id)}>
                    {sp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Kund</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla kunder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kunder</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Atteststatus</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="attested">Attesterade</SelectItem>
                <SelectItem value="not_attested">Ej attesterade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Fakturering</Label>
            <Select value={selectedInvoiceStatus} onValueChange={setSelectedInvoiceStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="invoiced">Fakturerade</SelectItem>
                <SelectItem value="not_invoiced">Ej fakturerade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Vecka</Label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Alla veckor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla veckor</SelectItem>
                {weekOptions.map((wk) => (
                  <SelectItem key={wk} value={wk}>
                    {`Vecka ${wk.split("W")[1]}, ${wk.split("-")[0]}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Datumintervall</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[150px]" />
              <span className="text-sm text-muted-foreground">–</span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[150px]" />
            </div>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={loadEntries} disabled={loading} className="w-full">
              Uppdatera
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <Button
          className="w-full md:flex-1 bg-gradient-primary"
          onClick={attestAllFiltered}
          disabled={bulkAttesting || pendingFilteredCount === 0}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {bulkAttesting ? "Attesterar..." : "Attestera alla filtrerade"}
        </Button>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <Button
            variant="outline"
            className="w-full md:w-auto"
            onClick={exportToPDF}
            disabled={exportingPdf || filteredEntries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {exportingPdf ? "Exporterar..." : "Exportera PDF"}
          </Button>
          <Button
            variant="outline"
            className="w-full md:w-auto"
            onClick={exportCustomerPdf}
            disabled={exportingCustomerPdf || filteredEntries.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            {exportingCustomerPdf ? "Exporterar..." : "Exportera kundunderlag PDF"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredEntries.length === 0 && (
          <Card>
            <CardContent className="py-6 text-muted-foreground text-sm">Inga tidrapporter att visa.</CardContent>
          </Card>
        )}

        {filteredEntries.map((entry) => {
          const d = entry.date ? new Date(entry.date) : null;
          const dateLabel =
            d && !Number.isNaN(d.getTime())
              ? `${format(d, "EEEE d MMMM", { locale: sv })}`
              : entry.date || "Okänt datum";

          const userName = entry.user_full_name || entry.user_email || entry.user_id;
          const shift = entry.shift_type || "–";
          const restLabel = entry.break_minutes ? `${entry.break_minutes} min` : "Ingen rast";
          return (
            <Card key={entry.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {statusBadge(entry)}
                    <span>{userName} – {dateLabel}</span>
                    <span className="text-muted-foreground text-sm">{entry.total_hours.toFixed(2)} h</span>
                  </CardTitle>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                    <span>{entry.start_time || "–"} – {entry.end_time || "–"}</span>
                    <span>Rast: {restLabel}</span>
                    <span>Skift: {shift}</span>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                    <span>Projekt: {entry.project?.name || "–"}</span>
                    {entry.subproject?.name && <span>Underprojekt: {entry.subproject.name}</span>}
                    <span>Roll: {entry.job_role?.name || "–"}</span>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                    <span>Traktamente: {entry.per_diem_type || "none"}</span>
                    <span>Restid: {entry.travel_time_hours ?? 0}h</span>
                    <span>ÖT vardag: {entry.overtime_weekday_hours ?? 0}h</span>
                    <span>ÖT helg: {entry.overtime_weekend_hours ?? 0}h</span>
                  </div>
                  {entry.ao_number && <div className="text-sm text-muted-foreground">AO: {entry.ao_number}</div>}
                  {entry.materials && entry.materials.length > 0 && (
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                      {entry.materials.map((m) => {
                        const mt = materialTypes.find((t) => t.id === String(m.material_type_id));
                        return (
                          <Badge key={`${entry.id}-mat-${m.material_type_id}`} variant="outline">
                            {mt?.name || m.material_type_id}: {m.quantity} {mt?.unit || ""}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {entry.work_description && (
                    <p className="text-sm text-muted-foreground">Kommentar: {entry.work_description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>
                    <Pencil className="h-4 w-4 mr-1" /> Redigera
                  </Button>
                  {entry.attested_by ? (
                    <Button size="sm" variant="outline" onClick={() => attestEntry(entry.id, false)}>
                      <Unlock className="h-4 w-4 mr-1" /> Lås upp
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => attestEntry(entry.id, true)}>
                      <Lock className="h-4 w-4 mr-1" /> Attestera
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => { setEditEntry(entry); setShowDeleteConfirm(true); }}>
                    Radera
                  </Button>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Redigera tidrapport</DialogTitle>
            <DialogDescription>Uppdatera tid, projekt, roll och övriga fält.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">Datum</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm text-muted-foreground">Starttid</Label>
                  <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Sluttid</Label>
                  <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">Rast</Label>
                <Select value={editBreakMinutes} onValueChange={setEditBreakMinutes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj rast" />
                  </SelectTrigger>
                  <SelectContent>
                    {REST_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m === "0" ? "Ingen rast" : `${m} minuter`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">AO-nummer (valfritt)</Label>
                <Input value={editAoNumber} onChange={(e) => setEditAoNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Projekt</Label>
              <Select value={editProjectId || undefined} onValueChange={(v) => { setEditProjectId(v); setEditSubprojectId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj projekt" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Underprojekt (valfritt)</Label>
              <Select value={editSubprojectId || undefined} onValueChange={setEditSubprojectId} disabled={!editProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj underprojekt" />
                </SelectTrigger>
                <SelectContent>
                  {subprojectsForProject.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Yrkesroll</Label>
              <Select value={editJobRoleId || undefined} onValueChange={setEditJobRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj yrkesroll" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Traktamente</label>
                <Select value={editPerDiem || undefined} onValueChange={setEditPerDiem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Traktamente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    <SelectItem value="half">Halv</SelectItem>
                    <SelectItem value="full">Hel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Restid (timmar)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.25"
                  value={editTravelHours}
                  onChange={(e) => setEditTravelHours(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="saveTravel"
                    checked={editSaveTravelComp}
                    onCheckedChange={(v) => setEditSaveTravelComp(v === true)}
                  />
                  <label htmlFor="saveTravel" className="text-sm text-muted-foreground">Spara restidsersättning</label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Övertid vardag (timmar)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editOvertimeWeekday}
                  onChange={(e) => setEditOvertimeWeekday(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Övertid helg (timmar)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editOvertimeWeekend}
                  onChange={(e) => setEditOvertimeWeekend(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">Komptid</Label>
                <Select
                  value={editCompTimeAction}
                  onValueChange={(value) => {
                    const next = value as "none" | "save" | "take";
                    setEditCompTimeAction(next);
                    if (next === "none") setEditCompTimeHours("0");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    <SelectItem value="save">Spara komptid</SelectItem>
                    <SelectItem value="take">Uttag komptid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  {editCompTimeAction === "take"
                    ? "Uttag komptid (timmar)"
                    : editCompTimeAction === "save"
                    ? "Spara komptid (timmar)"
                    : "Komptid (timmar)"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editCompTimeHours}
                  onChange={(e) => setEditCompTimeHours(e.target.value)}
                  disabled={editCompTimeAction === "none"}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Arbetsbeskrivning</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Lägg till tillägg</Label>
              <div className="flex gap-2">
                <Select value={selectedMaterialType || undefined} onValueChange={setSelectedMaterialType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Välj material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialTypes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.unit ? `(${m.unit})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Antal"
                  value={materialQuantity}
                  onChange={(e) => setMaterialQuantity(e.target.value)}
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!selectedMaterialType) return;
                    const qty = Number(materialQuantity) || 0;
                    if (qty <= 0) return;
                    // ersätt om samma typ redan finns
                    setEditMaterials((prev) => {
                      const filtered = prev.filter((m) => m.material_type_id !== selectedMaterialType);
                      return [...filtered, { material_type_id: selectedMaterialType, quantity: qty }];
                    });
                    setMaterialQuantity("0");
                    setSelectedMaterialType("");
                  }}
                >
                  Lägg till
                </Button>
              </div>
              {editMaterials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editMaterials.map((m) => {
                    const mt = materialTypes.find((t) => t.id === m.material_type_id);
                    return (
                      <Badge key={m.material_type_id} variant="secondary" className="gap-1">
                        {mt?.name || m.material_type_id}: {m.quantity} {mt?.unit || ""}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setEditMaterials((prev) => prev.filter((x) => x.material_type_id !== m.material_type_id))}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {editEntry && (
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                  Ta bort
                </Button>
              )}
              <Button variant="outline" onClick={() => setEditEntry(null)}>
                Avbryt
              </Button>
              <Button onClick={saveEdit}>Spara</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort tidrapport</DialogTitle>
            <DialogDescription>Är du säker på att du vill ta bort denna tidrapport? Detta kan inte ångras.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Avbryt</Button>
            <Button variant="destructive" onClick={deleteEntry}>Ta bort</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
