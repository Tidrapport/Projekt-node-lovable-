import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { sv } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileText, Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { calculateOBDistributionWithOvertime } from "@/lib/obDistribution";
import { generateInvoicePdf, InvoiceLine, InvoiceMeta, InvoiceTotals, CompanyFooter } from "@/lib/invoicePdf";

interface TimeEntry {
  id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  break_minutes?: number | null;
  total_hours: number;
  travel_time_hours?: number | null;
  overtime_weekday_hours?: number | null;
  overtime_weekend_hours?: number | null;
  per_diem_type?: string | null;
  job_role_id?: string | null;
  materials?: { material_type_id: string | number; quantity: number }[];
  attested_by: string | null;
  project_id: string | null;
  subproject_id: string | null;
  user_id: string;
  project?: { id: string; name: string; customer_id?: string | null; customer_name?: string | null };
  subproject?: { id: string; name: string | null };
  profiles?: { id: string; full_name: string | null };
}

interface Customer {
  id: string;
  name: string;
  customer_number?: string | null;
  customer_type?: string | null;
  orgnr?: string | null;
  vat_number?: string | null;
  reverse_vat?: boolean | number | null;
  invoice_address1?: string | null;
  invoice_address2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  phone_secondary?: string | null;
  invoice_email?: string | null;
  payment_terms?: string | null;
  their_reference?: string | null;
  notes?: string | null;
}

interface Project {
  id: string;
  name: string;
  code?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
}

interface Subproject {
  id: string;
  name: string;
  project_id: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
}

type CompanyInfo = {
  id: string;
  name: string;
  billing_email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  bankgiro?: string | null;
  bic_number?: string | null;
  iban_number?: string | null;
  logo_url?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
  f_skatt?: number | null;
  invoice_payment_terms?: string | null;
  invoice_our_reference?: string | null;
  invoice_late_interest?: string | null;
};

type PriceListJobRole = {
  id: string;
  name: string;
  article_number?: string | null;
  day_article_number?: string | null;
  evening_article_number?: string | null;
  night_article_number?: string | null;
  weekend_article_number?: string | null;
  overtime_weekday_article_number?: string | null;
  overtime_weekend_article_number?: string | null;
  per_diem_article_number?: string | null;
  travel_time_article_number?: string | null;
  day_rate: number | null;
  evening_rate: number | null;
  night_rate: number | null;
  weekend_rate: number | null;
  overtime_weekday_rate: number | null;
  overtime_weekend_rate: number | null;
  per_diem_rate: number | null;
  travel_time_rate: number | null;
};

type PriceListMaterial = {
  id: string;
  name: string;
  article_number?: string | null;
  price: number | null;
  unit: string;
};

type PriceListSettings = {
  show_day?: boolean | number;
  show_evening?: boolean | number;
  show_night?: boolean | number;
  show_weekend?: boolean | number;
  show_overtime_weekday?: boolean | number;
  show_overtime_weekend?: boolean | number;
  day_start?: string;
  day_end?: string;
  evening_start?: string;
  evening_end?: string;
  night_start?: string;
  night_end?: string;
  weekend_start?: string;
  weekend_end?: string;
};

type PriceListResponse = {
  year: number;
  job_roles: PriceListJobRole[];
  material_types: PriceListMaterial[];
  settings?: PriceListSettings;
};

const Billing = () => {
  const { user, companyId } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [exportingInvoicePdf, setExportingInvoicePdf] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const [customerId, setCustomerId] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("all");
  const [subprojectId, setSubprojectId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [invoiceStatus, setInvoiceStatus] = useState<string>("all");
  const [attestStatus, setAttestStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    void fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [entryData, customerData, projectData, subprojectData, userData] = await Promise.all([
        apiFetch<any[]>("/time-entries?include_materials=true"),
        apiFetch<Customer[]>("/customers"),
        apiFetch<Project[]>("/projects?active=true"),
        apiFetch<Subproject[]>("/subprojects?active=true"),
        apiFetch<UserProfile[]>("/admin/users"),
      ]);

      const normalized = ensureArray(entryData).map((e) => ({
        id: String(e.id),
        date: e.datum || e.date || "",
        start_time: e.starttid && e.starttid !== "null" ? e.starttid : e.start_time || "",
        end_time: e.sluttid && e.sluttid !== "null" ? e.sluttid : e.end_time || "",
        break_minutes: e.break_minutes != null ? Number(e.break_minutes) : 0,
        total_hours: e.timmar != null ? Number(e.timmar) : Number(e.total_hours) || 0,
        travel_time_hours: e.restid != null ? Number(e.restid) : Number(e.travel_time_hours) || 0,
        overtime_weekday_hours: e.overtime_weekday_hours ?? null,
        overtime_weekend_hours: e.overtime_weekend_hours ?? null,
        per_diem_type: e.per_diem_type || e.traktamente_type || null,
        job_role_id: e.job_role_id != null ? String(e.job_role_id) : null,
        materials: ensureArray(e.materials).map((m: any) => ({
          material_type_id: String(m.material_type_id),
          quantity: Number(m.quantity) || 0,
        })),
        attested_by: e.attested_by != null ? String(e.attested_by) : null,
        invoiced: e.invoiced ?? false,
        project_id: e.project_id != null ? String(e.project_id) : null,
        subproject_id: e.subproject_id != null ? String(e.subproject_id) : null,
        user_id: e.user_id != null ? String(e.user_id) : "",
        project:
          e.project_name || e.customer_name
            ? {
                id: String(e.project_id || ""),
                name: e.project_name || "",
                customer_id: e.customer_id != null ? String(e.customer_id) : null,
                customer_name: e.customer_name
              }
            : e.project,
        subproject: e.subproject_name ? { id: String(e.subproject_id || ""), name: e.subproject_name, project_id: e.project_id } : e.subproject,
        profiles: e.user_full_name ? { id: String(e.user_id || ""), full_name: e.user_full_name } : e.profiles,
      })) as TimeEntry[];

      setEntries(normalized);
      const customersArray = ensureArray(customerData);
      const projectsArray = ensureArray(projectData);
      const subprojectsArray = ensureArray(subprojectData);
      const usersArray = ensureArray(userData);

      setCustomers(customersArray);
      setProjects(projectsArray);
      setSubprojects(subprojectsArray);
      setUsers(usersArray);
    } catch (error: any) {
      console.error(error);
      toast.error("Kunde inte ladda faktureringsunderlag.");
    }
  };

  const filteredSubprojects = useMemo(() => {
    if (projectId === "all") return subprojects;
    return subprojects.filter((s) => String(s.project_id) === projectId);
  }, [projectId, subprojects]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (customerId !== "all") {
        const proj = entry.project;
        const matchesCustomer =
          proj &&
          (String(proj.customer_id || "") === customerId ||
            (proj.customer_name && proj.customer_name === customers.find((c) => String(c.id) === customerId)?.name));
        if (!matchesCustomer) return false;
      }
      if (projectId !== "all" && String(entry.project_id || "") !== projectId) return false;
      if (subprojectId !== "all" && String(entry.subproject_id || "") !== subprojectId) return false;
      if (userId !== "all" && String(entry.user_id || "") !== userId) return false;
      if (attestStatus === "attested" && !entry.attested_by) return false;
      if (attestStatus === "not_attested" && entry.attested_by) return false;
      if (invoiceStatus === "invoiced" && !(entry as any).invoiced) return false;
      if (invoiceStatus === "not_invoiced" && (entry as any).invoiced) return false;

      const d = entry.date ? new Date(entry.date) : null;
      const fromD = fromDate ? new Date(fromDate) : null;
      const toD = toDate ? new Date(toDate) : null;
      if (d && !Number.isNaN(d.getTime())) {
        if (fromD && !Number.isNaN(fromD.getTime()) && d < fromD) return false;
        if (toD && !Number.isNaN(toD.getTime()) && d > toD) return false;
      }

      return true;
    });
  }, [entries, customerId, projectId, subprojectId, userId, fromDate, toDate, customers, attestStatus, invoiceStatus]);

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedEntries(new Set());
      return;
    }
    setSelectedEntries(new Set(filteredEntries.map((entry) => entry.id)));
  }, [filteredEntries]);

  const totals = useMemo(() => {
    const hours = filteredEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const travel = filteredEntries.reduce((sum, e) => sum + (e.travel_time_hours || 0), 0);
    const attested = filteredEntries.filter((e) => e.attested_by).length;
    return { hours, travel, attested, count: filteredEntries.length };
  }, [filteredEntries]);

  const getProjectName = (entry: TimeEntry) => entry.project?.name || (entry as any).project_name || "–";
  const getSubprojectName = (entry: TimeEntry) => entry.subproject?.name || (entry as any).subproject_name || "–";
  const getCustomerName = (entry: TimeEntry) => {
    if (entry.project?.customer_name) return entry.project.customer_name;
    const projCustomer = customers.find(
      (c) => String(c.id) === String(entry.project?.customer_id || (entry as any).customer_id || "")
    );
    return projCustomer?.name || "–";
  };
  const getUserName = (entry: TimeEntry) => entry.profiles?.full_name || (entry as any).user_full_name || "–";
  const safeFormatDate = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : null;
    if (d && !Number.isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
    return dateStr || "";
  };

  const timeToHours = (value: string | undefined, fallback: number) => {
    const match = String(value || "").match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return fallback;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours + minutes / 60;
  };

  const toBool = (value: unknown, fallback = true) => {
    if (value === null || value === undefined) return fallback;
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    return false;
  };

  const hasProjectRates = (priceList: PriceListResponse) => {
    const roleHasRate = priceList.job_roles.some((role) =>
      [
        role.day_rate,
        role.evening_rate,
        role.night_rate,
        role.weekend_rate,
        role.overtime_weekday_rate,
        role.overtime_weekend_rate,
        role.per_diem_rate,
        role.travel_time_rate,
      ].some((val) => val !== null && val !== undefined)
    );
    const materialHasRate = priceList.material_types.some((mat) => mat.price !== null && mat.price !== undefined);
    return roleHasRate || materialHasRate;
  };

  const buildInvoiceLines = (
    invoiceEntries: TimeEntry[],
    priceList: PriceListResponse
  ): { lines: InvoiceLine[]; totals: InvoiceTotals } => {
    const jobRoleRates = new Map(priceList.job_roles.map((role) => [role.id, role]));
    const materialRates = new Map(priceList.material_types.map((mat) => [mat.id, mat]));

    const toPositive = (value: number | string | null | undefined) => {
      if (value === null || value === undefined) return 0;
      const numeric =
        typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
      return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
    };
    const getArticleNumber = (value?: string | null, fallback?: string | null) => {
      const raw = String(value ?? "").trim();
      if (raw) return raw;
      const base = String(fallback ?? "").trim();
      return base;
    };

    const settings = priceList.settings || {};
    const visibility = {
      day: toBool(settings.show_day, true),
      evening: toBool(settings.show_evening, true),
      night: toBool(settings.show_night, true),
      weekend: toBool(settings.show_weekend, true),
      overtimeWeekday: toBool(settings.show_overtime_weekday, true),
      overtimeWeekend: toBool(settings.show_overtime_weekend, true),
    };
    const shiftWindows = {
      day: { start: timeToHours(settings.day_start, 6), end: timeToHours(settings.day_end, 18) },
      evening: { start: timeToHours(settings.evening_start, 18), end: timeToHours(settings.evening_end, 21) },
      night: { start: timeToHours(settings.night_start, 21), end: timeToHours(settings.night_end, 6) },
      weekend: { start: timeToHours(settings.weekend_start, 18), end: timeToHours(settings.weekend_end, 6) },
    };

    const mergeDistribution = (distribution: { day: number; evening: number; night: number; weekend: number }) => {
      const next = { ...distribution };
      const merge = (from: keyof typeof next, to: keyof typeof next) => {
        if (next[from] <= 0) return;
        next[to] += next[from];
        next[from] = 0;
      };
      if (!visibility.weekend) {
        if (visibility.night) merge("weekend", "night");
        else if (visibility.evening) merge("weekend", "evening");
        else if (visibility.day) merge("weekend", "day");
      }
      if (!visibility.night) {
        if (visibility.evening) merge("night", "evening");
        else if (visibility.day) merge("night", "day");
      }
      if (!visibility.evening) {
        if (visibility.night) merge("evening", "night");
        else if (visibility.day) merge("evening", "day");
      }
      if (!visibility.day) {
        if (visibility.night) merge("day", "night");
        else if (visibility.evening) merge("day", "evening");
        else if (visibility.weekend) merge("day", "weekend");
      }
      return next;
    };

    const lineMap = new Map<string, InvoiceLine>();
    const orderedLines: InvoiceLine[] = [];

    const addLine = (key: string, line: InvoiceLine) => {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) return;
      const existing = lineMap.get(key);
      if (existing) {
        existing.quantity += line.quantity;
        existing.total += line.total;
        return;
      }
      lineMap.set(key, line);
      orderedLines.push(line);
    };

    invoiceEntries.forEach((entry) => {
      const role = entry.job_role_id ? jobRoleRates.get(entry.job_role_id) : null;
      const roleName = role?.name || "Yrkesroll";
      const baseArticleNumber = role?.article_number ? String(role.article_number).trim() : "";
      const userLabel = entry.profiles?.full_name || (entry as any).user_full_name || "Okänd";
      const userKey = entry.user_id || userLabel;
      const linePrefix = userLabel ? `${userLabel} - ` : "";
      const totalHours = toPositive(entry.total_hours);
      const overtimeWeekdayRaw = toPositive(entry.overtime_weekday_hours);
      const overtimeWeekendRaw = toPositive(entry.overtime_weekend_hours);
      const overtimeWeekday = visibility.overtimeWeekday ? overtimeWeekdayRaw : 0;
      const overtimeWeekend = visibility.overtimeWeekend ? overtimeWeekendRaw : 0;

      let distribution = { day: totalHours, evening: 0, night: 0, weekend: 0 };
      if (entry.date && entry.start_time && entry.end_time) {
        distribution = calculateOBDistributionWithOvertime(
          entry.date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes || 0,
          overtimeWeekday,
          overtimeWeekend,
          shiftWindows
        );
      }
      distribution = {
        day: toPositive(distribution.day),
        evening: toPositive(distribution.evening),
        night: toPositive(distribution.night),
        weekend: toPositive(distribution.weekend),
      };
      distribution = mergeDistribution(distribution);

      if (visibility.day) {
        addLine(`${userKey}-${roleName}-day`, {
          item_no: getArticleNumber(role?.day_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Dag`,
          quantity: distribution.day,
          unit: "tim",
          unit_price: Number(role?.day_rate ?? 0),
          total: distribution.day * Number(role?.day_rate ?? 0),
        });
      }
      if (visibility.evening) {
        addLine(`${userKey}-${roleName}-evening`, {
          item_no: getArticleNumber(role?.evening_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Kväll`,
          quantity: distribution.evening,
          unit: "tim",
          unit_price: Number(role?.evening_rate ?? 0),
          total: distribution.evening * Number(role?.evening_rate ?? 0),
        });
      }
      if (visibility.night) {
        addLine(`${userKey}-${roleName}-night`, {
          item_no: getArticleNumber(role?.night_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Natt`,
          quantity: distribution.night,
          unit: "tim",
          unit_price: Number(role?.night_rate ?? 0),
          total: distribution.night * Number(role?.night_rate ?? 0),
        });
      }
      if (visibility.weekend) {
        addLine(`${userKey}-${roleName}-weekend`, {
          item_no: getArticleNumber(role?.weekend_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Helg`,
          quantity: distribution.weekend,
          unit: "tim",
          unit_price: Number(role?.weekend_rate ?? 0),
          total: distribution.weekend * Number(role?.weekend_rate ?? 0),
        });
      }

      if (visibility.overtimeWeekday && overtimeWeekdayRaw > 0) {
        addLine(`${userKey}-${roleName}-overtime-weekday`, {
          item_no: getArticleNumber(role?.overtime_weekday_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Övertid vardag`,
          quantity: overtimeWeekdayRaw,
          unit: "tim",
          unit_price: Number(role?.overtime_weekday_rate ?? 0),
          total: overtimeWeekdayRaw * Number(role?.overtime_weekday_rate ?? 0),
        });
      }

      if (visibility.overtimeWeekend && overtimeWeekendRaw > 0) {
        addLine(`${userKey}-${roleName}-overtime-weekend`, {
          item_no: getArticleNumber(role?.overtime_weekend_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Övertid helg`,
          quantity: overtimeWeekendRaw,
          unit: "tim",
          unit_price: Number(role?.overtime_weekend_rate ?? 0),
          total: overtimeWeekendRaw * Number(role?.overtime_weekend_rate ?? 0),
        });
      }

      if (entry.travel_time_hours) {
        const travelHours = toPositive(entry.travel_time_hours);
        addLine(`${userKey}-${roleName}-travel`, {
          item_no: getArticleNumber(role?.travel_time_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Restid`,
          quantity: travelHours,
          unit: "tim",
          unit_price: Number(role?.travel_time_rate ?? 0),
          total: travelHours * Number(role?.travel_time_rate ?? 0),
        });
      }

      const perDiemDays = entry.per_diem_type === "full" ? 1 : entry.per_diem_type === "half" ? 0.5 : 0;
      if (perDiemDays) {
        addLine(`${userKey}-${roleName}-perdiem`, {
          item_no: getArticleNumber(role?.per_diem_article_number, baseArticleNumber),
          description: `${linePrefix}${roleName} Traktamente`,
          quantity: perDiemDays,
          unit: "dag",
          unit_price: Number(role?.per_diem_rate ?? 0),
          total: perDiemDays * Number(role?.per_diem_rate ?? 0),
        });
      }

      (entry.materials || []).forEach((mat) => {
        const materialInfo = materialRates.get(String(mat.material_type_id));
        const quantity = toPositive(mat.quantity);
        if (!materialInfo || quantity === 0) return;
        addLine(`material-${userKey}-${materialInfo.id}`, {
          item_no: materialInfo.article_number ? String(materialInfo.article_number).trim() : "",
          description: `${linePrefix}${materialInfo.name}`,
          quantity,
          unit: materialInfo.unit || "",
          unit_price: Number(materialInfo.price ?? 0),
          total: quantity * Number(materialInfo.price ?? 0),
        });
      });
    });

    const subtotal = orderedLines.reduce((sum, line) => sum + line.total, 0);
    const vatRate = 25;
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    return {
      lines: orderedLines,
      totals: {
        subtotal,
        vat,
        total,
        vat_rate: vatRate,
      },
    };
  };

  const exportCSV = () => {
    if (!filteredEntries.length) {
      toast.error("Inget att exportera.");
      return;
    }
    const header = ["Datum", "Användare", "Kund", "Projekt", "Underprojekt", "Timmar", "Restid", "Status"];
    const rows = filteredEntries.map((e) => [
      e.date,
      getUserName(e),
      getCustomerName(e),
      getProjectName(e),
      getSubprojectName(e),
      e.total_hours?.toFixed(2) ?? "0",
      (e.travel_time_hours ?? 0).toFixed(2),
      e.attested_by ? "Attesterad" : "Ej attesterad",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fakturering_fortnox.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fortnox-fil genererad.");
  };

  const sendSelectedToFortnox = async () => {
    const ids = Array.from(selectedEntries);
    if (ids.length === 0) {
      toast.error("Välj minst en rad att skicka.");
      return;
    }

    const chosen = filteredEntries.filter((e) => selectedEntries.has(e.id));
    if (!chosen.length) {
      toast.error("Inga valda rader hittades i filtren.");
      return;
    }

    if (projectId === "all") {
      toast.error("Välj ett projekt för fakturan.");
      return;
    }

    try {
      const entryDates = chosen
        .map((entry) => (entry.date ? new Date(entry.date) : null))
        .filter((d) => d && !Number.isNaN(d.getTime())) as Date[];
      const periodStart = entryDates.length ? new Date(Math.min(...entryDates.map((d) => d.getTime()))) : new Date();
      const priceListYear = periodStart.getFullYear();

      const params = new URLSearchParams({ year: String(priceListYear), project_id: projectId });
      let priceList = await apiFetch<PriceListResponse>(`/price-list?${params.toString()}`);
      if (!hasProjectRates(priceList)) {
        const baseParams = new URLSearchParams({ year: String(priceListYear) });
        priceList = await apiFetch<PriceListResponse>(`/price-list?${baseParams.toString()}`);
      }

      const { lines } = buildInvoiceLines(chosen, priceList);
      if (!lines.length) {
        toast.error("Inga fakturarader kunde skapas.");
        return;
      }

      const selectedProject = projects.find((p) => String(p.id) === projectId);
      const targetCustomer =
        customerId !== "all"
          ? customers.find((c) => String(c.id) === customerId)
          : customers.find((c) => String(c.id) === String(selectedProject?.customer_id || ""));
      if (!targetCustomer) {
        toast.error("Kunde inte hitta kund för fakturan.");
        return;
      }

      const customerNumber = targetCustomer.customer_number || (targetCustomer.id ? String(targetCustomer.id) : "");
      if (!customerNumber) {
        toast.error("Kunden saknar Fortnox kundnummer.");
        return;
      }

      const companies = await apiFetch<CompanyInfo[]>(`/companies`);
      const company = companyId
        ? (companies || []).find((c) => String(c.id) === String(companyId))
        : (companies || [])[0];

      const paymentTerms =
        targetCustomer.payment_terms?.trim() || company?.invoice_payment_terms?.trim() || "30 dagar";
      const numericDaysMatch = paymentTerms.match(/\d+/);
      const paymentDays = numericDaysMatch ? Number(numericDaysMatch[0]) : 30;

      const invoiceDate = new Date();
      const dueDate = addDays(invoiceDate, Number.isFinite(paymentDays) ? paymentDays : 30);

      const invoiceRows = lines.map((line) => {
        const row: Record<string, any> = {
          Description: line.description,
          DeliveredQuantity: Number(line.quantity.toFixed(2)),
          Unit: line.unit || "",
          Price: Number(line.unit_price.toFixed(2)),
        };
        return row;
      });

      const invoicePayload = {
        CustomerNumber: customerNumber,
        InvoiceDate: format(invoiceDate, "yyyy-MM-dd"),
        DueDate: format(dueDate, "yyyy-MM-dd"),
        OurReference: company?.invoice_our_reference || user?.full_name || user?.email || "",
        YourReference: targetCustomer.their_reference || targetCustomer.contact_name || "",
        InvoiceRows: invoiceRows,
      };

      const filename = `fortnox_invoice_${Date.now()}.json`;
      const result = await apiFetch<{ forwarded?: boolean; message?: string }>('/admin/fortnox/push_invoice', {
        method: 'POST',
        json: { company_id: companyId, filename, invoice: invoicePayload }
      });
      if (result?.forwarded) {
        toast.success('Skickat till Fortnox.');
      } else {
        toast.success(result?.message || 'Sparat lokalt, ingen Fortnox-token.');
      }
    } catch (err: any) {
      console.error('Error pushing invoice to server:', err);
      toast.error(err?.message || 'Kunde inte skicka faktura till server');
    }
  };

  const exportPDF = () => {
    if (!filteredEntries.length) {
      toast.error("Inget att exportera.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Fakturaunderlag", 14, 18);
    doc.setFontSize(11);
    const periodLine =
      fromDate || toDate
        ? `Period: ${fromDate || "..."} - ${toDate || "..."}`
        : "Period: Alla datum";
    doc.text(periodLine, 14, 26);

    autoTable(doc, {
      startY: 34,
      head: [["Datum", "Användare", "Kund", "Projekt", "Underprojekt", "Timmar", "Restid", "Status"]],
      body: filteredEntries.map((e) => [
        safeFormatDate(e.date),
        getUserName(e),
        getCustomerName(e),
        getProjectName(e),
        getSubprojectName(e),
        e.total_hours?.toFixed(2) ?? "0",
        (e.travel_time_hours ?? 0).toFixed(2),
        e.attested_by ? "Attesterad" : "Ej attesterad",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [6, 99, 197] },
    });

    doc.text(`Rader: ${totals.count}`, 14, doc.lastAutoTable.finalY + 10);
    doc.text(`Totalt timmar: ${totals.hours.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 16);
    doc.text(`Restid: ${totals.travel.toFixed(2)} h`, 14, doc.lastAutoTable.finalY + 22);
    doc.text(`Attesterade: ${totals.attested}`, 14, doc.lastAutoTable.finalY + 28);

    doc.save("fakturering.pdf");
    toast.success("PDF skapad.");
  };

  const exportInvoicePdf = async () => {
    if (!filteredEntries.length) {
      toast.error("Inget att fakturera.");
      return;
    }
    if (projectId === "all") {
      toast.error("Välj ett projekt för fakturan.");
      return;
    }
    setExportingInvoicePdf(true);
    try {
      const entryDates = filteredEntries
        .map((entry) => (entry.date ? new Date(entry.date) : null))
        .filter((d) => d && !Number.isNaN(d.getTime())) as Date[];
      const periodStart = entryDates.length ? new Date(Math.min(...entryDates.map((d) => d.getTime()))) : new Date();
      const priceListYear = periodStart.getFullYear();

      const params = new URLSearchParams({ year: String(priceListYear), project_id: projectId });
      let priceList = await apiFetch<PriceListResponse>(`/price-list?${params.toString()}`);
      if (!hasProjectRates(priceList)) {
        const baseParams = new URLSearchParams({ year: String(priceListYear) });
        priceList = await apiFetch<PriceListResponse>(`/price-list?${baseParams.toString()}`);
      }

      const { lines, totals } = buildInvoiceLines(filteredEntries, priceList);
      if (!lines.length) {
        toast.error("Inga fakturarader kunde skapas.");
        return;
      }
      if (lines.length > 18) {
        toast.error("För många fakturarader för fakturamallen.");
        return;
      }

      const selectedProject = projects.find((p) => String(p.id) === projectId);
      const targetCustomer =
        customerId !== "all"
          ? customers.find((c) => String(c.id) === customerId)
          : customers.find((c) => String(c.id) === String(selectedProject?.customer_id || ""));

      const customerLines: string[] = [];
      if (targetCustomer?.name) customerLines.push(targetCustomer.name);
      if (targetCustomer?.invoice_address1) customerLines.push(targetCustomer.invoice_address1);
      if (targetCustomer?.invoice_address2) customerLines.push(targetCustomer.invoice_address2);
      const postalCity = [targetCustomer?.postal_code, targetCustomer?.city].filter(Boolean).join(" ");
      if (postalCity) customerLines.push(postalCity);
      if (targetCustomer?.country) customerLines.push(targetCustomer.country);

      const companies = await apiFetch<CompanyInfo[]>(`/companies`);
      const company = companyId
        ? (companies || []).find((c) => String(c.id) === String(companyId))
        : (companies || [])[0];

      const paymentTerms =
        targetCustomer?.payment_terms?.trim() || company?.invoice_payment_terms?.trim() || "30 dagar";
      const numericDaysMatch = paymentTerms.match(/\d+/);
      const paymentDays = numericDaysMatch ? Number(numericDaysMatch[0]) : 30;

      const invoiceDate = new Date();
      const dueDate = addDays(invoiceDate, Number.isFinite(paymentDays) ? paymentDays : 30);
      const invoiceNumber = `${format(invoiceDate, "yyyyMMdd")}${projectId !== "all" ? projectId : ""}`;
      const ocr = invoiceNumber ? `${invoiceNumber}0` : "";

      const reverseVat = Boolean(targetCustomer?.reverse_vat);
      const adjustedTotals = reverseVat
        ? { ...totals, vat_rate: 0, vat: 0, total: totals.subtotal }
        : totals;

      const meta: InvoiceMeta = {
        invoice_date: format(invoiceDate, "yyyy-MM-dd"),
        invoice_number: invoiceNumber,
        ocr,
        customer_number: targetCustomer?.customer_number || (targetCustomer?.id ? String(targetCustomer.id) : ""),
        our_reference: company?.invoice_our_reference || user?.full_name || user?.email || "",
        their_reference: targetCustomer?.their_reference || targetCustomer?.contact_name || "",
        order_number: selectedProject?.code || selectedProject?.name || "",
        payment_terms: paymentTerms,
        due_date: format(dueDate, "yyyy-MM-dd"),
        vat_number: targetCustomer?.vat_number || targetCustomer?.orgnr || "",
        late_interest: company?.invoice_late_interest || "8%",
        vat_label: reverseVat ? "Omvänd byggmoms" : "",
        customer_address_lines: customerLines,
      };

      const footer: CompanyFooter | undefined = company
        ? {
            name: company.name,
            address_line1: company.address_line1,
            address_line2: company.address_line2,
            postal_code: company.postal_code,
            city: company.city,
            country: company.country,
            phone: company.phone,
            billing_email: company.billing_email,
            bankgiro: company.bankgiro,
            bic_number: company.bic_number,
            iban_number: company.iban_number,
            logo_url: company.logo_url,
            org_number: company.org_number,
            vat_number: company.vat_number,
            f_skatt: company.f_skatt,
          }
        : undefined;

      await generateInvoicePdf(meta, lines, adjustedTotals, footer);
      toast.success("Faktura skapad.");
    } catch (error: any) {
      console.error(error);
      toast.error("Kunde inte skapa faktura-PDF.");
    } finally {
      setExportingInvoicePdf(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fakturering</h1>
          <p className="text-sm text-muted-foreground">
            Filtrera tidrapporter per kund, projekt och användare. Exportera eller skicka till Fortnox.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportInvoicePdf} disabled={exportingInvoicePdf}>
            <FileText className="mr-2 h-4 w-4" />
            Faktura PDF
          </Button>
          <Button onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Fortnox-fil
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={sendSelectedToFortnox}>
            <Send className="mr-2 h-4 w-4" />
            Skicka till Fortnox
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Välj kund, projekt, underprojekt, användare och datumintervall.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Kund</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label>Projekt</Label>
            <Select value={projectId} onValueChange={(val) => { setProjectId(val); setSubprojectId("all"); }}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label>Underprojekt</Label>
            <Select value={subprojectId} onValueChange={setSubprojectId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla underprojekt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla underprojekt</SelectItem>
                {filteredSubprojects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Användare</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla användare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla användare</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || "Användare"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Från datum</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Till datum</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Atteststatus</Label>
            <Select value={attestStatus} onValueChange={setAttestStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="attested">Attesterade</SelectItem>
                <SelectItem value="not_attested">Ej attesterade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fakturering</Label>
            <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="invoiced">Fakturerade</SelectItem>
                <SelectItem value="not_invoiced">Ej fakturerade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="sr-only">Reset</Label>
            <Button variant="outline" className="w-full" onClick={() => {
              setCustomerId("all");
              setProjectId("all");
              setSubprojectId("all");
              setUserId("all");
              setInvoiceStatus("all");
              setAttestStatus("all");
              setFromDate("");
              setToDate("");
            }}>
              Rensa filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Översikt</CardTitle>
          <CardDescription>Summering för aktuell filtrering.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Rader</p>
            <p className="text-xl font-bold">{totals.count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Totalt timmar</p>
            <p className="text-xl font-bold">{totals.hours.toFixed(2)} h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Restid</p>
            <p className="text-xl font-bold">{totals.travel.toFixed(2)} h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Attesterade</p>
            <p className="text-xl font-bold">{totals.attested}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Underlag</CardTitle>
          <CardDescription>Matchande tidrapporter för vald filtrering.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen data matchar filtren.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={filteredEntries.length > 0 && selectedEntries.size === filteredEntries.length}
                      onChange={(ev) => {
                        if (ev.currentTarget.checked) setSelectedEntries(new Set(filteredEntries.map((e) => e.id)));
                        else setSelectedEntries(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Användare</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Underprojekt</TableHead>
                  <TableHead className="text-right">Timmar</TableHead>
                  <TableHead className="text-right">Restid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.id)}
                        onChange={(ev) => {
                          setSelectedEntries((prev) => {
                            const next = new Set(prev);
                            if (ev.currentTarget.checked) next.add(entry.id);
                            else next.delete(entry.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(entry.date), "yyyy-MM-dd", { locale: sv })}</TableCell>
                    <TableCell>{getUserName(entry)}</TableCell>
                    <TableCell>{getCustomerName(entry)}</TableCell>
                    <TableCell>{getProjectName(entry)}</TableCell>
                    <TableCell>{getSubprojectName(entry)}</TableCell>
                    <TableCell className="text-right">{(entry.total_hours || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{(entry.travel_time_hours || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.attested_by ? "default" : "secondary"}>
                        {entry.attested_by ? "Attesterad" : "Ej attesterad"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
