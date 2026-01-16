import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { generateInvoicePdf, InvoiceLine, InvoiceMeta, InvoiceTotals, CompanyFooter } from "@/lib/invoicePdf";
import { toast } from "sonner";
import { Building2, Copy, Eye, FileText, Plus, Trash2, Users } from "lucide-react";
import { addDays, addMonths, endOfMonth, format, getMonth, getYear, startOfMonth, subMonths } from "date-fns";
import { sv } from "date-fns/locale";

type Company = {
  id: string;
  name: string;
  code?: string | null;
  plan?: string | null;
  features?: string[] | null;
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
  f_skatt?: number | boolean | null;
  invoice_payment_terms?: string | null;
  invoice_our_reference?: string | null;
  invoice_late_interest?: string | null;
  created_at?: string | null;
  user_count?: number;
};

type AdminUser = {
  id: string | number;
  full_name?: string | null;
  email: string;
  role?: string | null;
  is_active?: number | null;
};

type BillingUser = {
  id: string | number;
  company_id: string | number | null;
  role?: string | null;
  created_at?: string | null;
  is_active?: number | null;
  deactivated_at?: string | null;
  reactivated_at?: string | null;
};

type PlanSetting = {
  plan: string;
  features: string[];
};

const parseSqlDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
};

const MAX_DATE = new Date(8640000000000000);

const buildActiveIntervals = (user: BillingUser) => {
  const createdAt = parseSqlDate(user.created_at);
  if (!createdAt) return { createdAt: null, intervals: [] as { start: Date; end: Date }[] };

  const deactivatedAt = parseSqlDate(user.deactivated_at);
  const reactivatedAt = parseSqlDate(user.reactivated_at);
  const hasValidDeactivation = deactivatedAt && deactivatedAt >= createdAt;
  const hasValidReactivation =
    reactivatedAt && (!hasValidDeactivation || reactivatedAt > deactivatedAt);

  if (user.is_active === 0 && !hasValidDeactivation) {
    return { createdAt, intervals: [] as { start: Date; end: Date }[] };
  }

  if (user.is_active === 1 && hasValidDeactivation && !hasValidReactivation) {
    return { createdAt, intervals: [{ start: createdAt, end: MAX_DATE }] };
  }

  const intervals: { start: Date; end: Date }[] = [];
  const firstEnd = hasValidDeactivation ? deactivatedAt! : MAX_DATE;
  intervals.push({ start: createdAt, end: firstEnd });

  if (hasValidDeactivation && hasValidReactivation) {
    intervals.push({ start: reactivatedAt!, end: MAX_DATE });
  }

  return { createdAt, intervals };
};

const intervalOverlaps = (start: Date, end: Date, rangeStart: Date, rangeEnd: Date) =>
  start <= rangeEnd && end >= rangeStart;

const isActiveOnDate = (intervals: { start: Date; end: Date }[], date: Date) =>
  intervals.some((interval) => interval.start <= date && interval.end >= date);

const toDigits = (value: string) => value.replace(/\D/g, "");

const formatVatNumber = (value: string) => {
  const digits = toDigits(value || "");
  if (!digits) return "";
  let base = digits;
  if (digits.length >= 12 && digits.endsWith("01")) {
    base = digits.slice(0, -2);
  } else if (digits.length > 10) {
    base = digits.slice(0, 10);
  }
  return `SE${base}01`;
};

const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const date = subMonths(new Date(), i);
  return {
    value: `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, "0")}`,
    label: format(date, "MMMM yyyy", { locale: sv }),
  };
});

const PLAN_OPTIONS = [
  { value: "Bas", label: "Bas" },
  { value: "Pro", label: "Pro" },
  { value: "Entreprise", label: "Entreprise" },
];

const FEATURE_OPTIONS = [
  { key: "dashboard", label: "Översikt" },
  { key: "time_reports", label: "Tidrapporter" },
  { key: "work_orders", label: "Arbetsordrar" },
  { key: "planning", label: "Planering" },
  { key: "deviations", label: "Avvikelser" },
  { key: "welding_reports", label: "Svetsrapporter" },
  { key: "salary_overview", label: "Lönöversikt" },
  { key: "contacts", label: "Kontakter" },
  { key: "documents", label: "Dokument & intyg" },
  { key: "statistics", label: "Statistik" },
  { key: "projects", label: "Projekt" },
  { key: "customers", label: "Kunder" },
  { key: "offers", label: "Offerter" },
  { key: "attestation", label: "Attestering" },
  { key: "billing", label: "Fakturering" },
  { key: "invoice_marking", label: "Fakturering markera" },
  { key: "salaries", label: "Löner" },
  { key: "admin_users", label: "Användare" },
  { key: "job_roles", label: "Yrkesroller" },
  { key: "material_types", label: "Tillägg" },
  { key: "ob_settings", label: "OB-inställningar" },
  { key: "invoice_settings", label: "Integrationer" },
  { key: "price_list", label: "Prislista" },
  { key: "time_report_settings", label: "Tidrapporteringsinställningar" },
  { key: "menu_settings", label: "Meny inställning" },
  { key: "activity_log", label: "Aktivitetslogg" },
  { key: "admin_hub", label: "AdminHub (Mitt Företag)" },
];

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyBillingEmail, setNewCompanyBillingEmail] = useState("");
  const [newCompanyOrgNumber, setNewCompanyOrgNumber] = useState("");
  const [newCompanyVatNumber, setNewCompanyVatNumber] = useState("");
  const [newCompanyAddress1, setNewCompanyAddress1] = useState("");
  const [newCompanyAddress2, setNewCompanyAddress2] = useState("");
  const [newCompanyPostalCode, setNewCompanyPostalCode] = useState("");
  const [newCompanyCity, setNewCompanyCity] = useState("");
  const [newCompanyCountry, setNewCompanyCountry] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyPlan, setNewCompanyPlan] = useState("Bas");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [planSettings, setPlanSettings] = useState<Record<string, string[]>>({});
  const [planSettingsLoading, setPlanSettingsLoading] = useState(false);
  const [planSettingsSaving, setPlanSettingsSaving] = useState<Record<string, boolean>>({});
  const [activePlanTab, setActivePlanTab] = useState("Bas");

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogTitle, setPasswordDialogTitle] = useState("");
  const [passwordDialogDescription, setPasswordDialogDescription] = useState("");
  const [passwordDialogValue, setPasswordDialogValue] = useState("");

  const [billingUsers, setBillingUsers] = useState<BillingUser[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(monthOptions[0].value);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const aiEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchPlanSettings();
  }, []);

  useEffect(() => {
    if (!editingCompany?.id) {
      setAdminUsers([]);
      setSelectedAdminId("");
      return;
    }
    fetchCompanyAdmins(String(editingCompany.id));
  }, [editingCompany?.id]);

  useEffect(() => {
    if (!aiMessages.length) return;
    aiEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMessages]);

  const fetchCompanies = async () => {
    try {
      const [companiesData, usersData] = await Promise.all([
        apiFetch<Company[]>(`/companies`),
        apiFetch<BillingUser[]>(`/admin/users?include_inactive=1&all=1`),
      ]);
      const companiesArray: Company[] = ensureArray(companiesData);
      const users = ensureArray(usersData).filter((u) => String(u.role || "").toLowerCase() !== "super_admin");
      setBillingUsers(users);
      const withCounts = companiesArray.map((company) => ({
        ...company,
        user_count: users.filter((u) => String(u.company_id) === String(company.id)).length,
      }));
      setCompanies(withCounts);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Kunde inte hämta företag");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanSettings = async () => {
    setPlanSettingsLoading(true);
    try {
      const data = await apiFetch<PlanSetting[]>(`/plan-settings`);
      const items = ensureArray<PlanSetting>(data);
      const map: Record<string, string[]> = {};
      items.forEach((item) => {
        map[item.plan] = Array.isArray(item.features) ? item.features : [];
      });
      PLAN_OPTIONS.forEach((plan) => {
        if (!map[plan.value]) map[plan.value] = [];
      });
      setPlanSettings(map);
    } catch (err: any) {
      console.error("Error fetching plan settings:", err);
      toast.error(err.message || "Kunde inte hämta planinställningar");
    } finally {
      setPlanSettingsLoading(false);
    }
  };

  const togglePlanFeature = (plan: string, feature: string) => {
    setPlanSettings((prev) => {
      const current = new Set(prev[plan] || []);
      if (current.has(feature)) {
        current.delete(feature);
      } else {
        current.add(feature);
      }
      return { ...prev, [plan]: Array.from(current) };
    });
  };

  const savePlanSettings = async (plan: string) => {
    setPlanSettingsSaving((prev) => ({ ...prev, [plan]: true }));
    try {
      await apiFetch(`/plan-settings/${encodeURIComponent(plan)}`, {
        method: "PUT",
        json: { features: planSettings[plan] || [] },
      });
      toast.success(`Plan ${plan} uppdaterad`);
      fetchPlanSettings();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte spara planinställningar");
    } finally {
      setPlanSettingsSaving((prev) => ({ ...prev, [plan]: false }));
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return `${pwd}Aa1`;
  };

  const fetchCompanyAdmins = async (companyId: string) => {
    setLoadingAdmins(true);
    try {
      const data = await apiFetch<AdminUser[]>(`/admin/users?company_id=${companyId}&include_inactive=1`);
      const admins = (data || []).filter(
        (u) => String(u.role || "").toLowerCase() === "admin"
      );
      setAdminUsers(admins);
      if (admins.length) {
        setSelectedAdminId(String(admins[0].id));
      } else {
        setSelectedAdminId("");
      }
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta admin-användare");
      setAdminUsers([]);
      setSelectedAdminId("");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleResetAdminPassword = async () => {
    const admin = adminUsers.find((u) => String(u.id) === String(selectedAdminId));
    if (!admin) {
      toast.error("Välj en admin att återställa");
      return;
    }
    setLoadingAdmins(true);
    const password = generatePassword();
    try {
      await apiFetch(`/admin/users/${admin.id}/reset-password`, {
        method: "POST",
        json: { password },
      });
      setPasswordDialogTitle("Nytt lösenord");
      setPasswordDialogDescription(`Admin: ${admin.full_name || admin.email}`);
      setPasswordDialogValue(password);
      setPasswordDialogOpen(true);
      setResetDialogOpen(false);
      toast.success("Lösenord återställt");
    } catch (err: any) {
      toast.error(err.message || "Kunde inte återställa lösenord");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const createCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Företagsnamn krävs");
      return;
    }
    if (!adminEmail.trim() || !adminPassword.trim() || !adminFirstName.trim() || !adminLastName.trim()) {
      toast.error("Fyll i uppgifter för admin (namn, e-post, lösenord)");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/companies", {
        method: "POST",
        json: {
          name: newCompanyName,
          billing_email: newCompanyBillingEmail || null,
          org_number: newCompanyOrgNumber || null,
          vat_number: formatVatNumber(newCompanyVatNumber || newCompanyOrgNumber) || null,
          address_line1: newCompanyAddress1 || null,
          address_line2: newCompanyAddress2 || null,
          postal_code: newCompanyPostalCode || null,
          city: newCompanyCity || null,
          country: newCompanyCountry || null,
          phone: newCompanyPhone || null,
          plan: newCompanyPlan,
          admin_first_name: adminFirstName,
          admin_last_name: adminLastName,
          admin_email: adminEmail,
          admin_password: adminPassword,
        },
      });
      toast.success("Företag skapat");
      setShowNewCompanyDialog(false);
      setNewCompanyName("");
      setNewCompanyBillingEmail("");
      setNewCompanyOrgNumber("");
      setNewCompanyVatNumber("");
      setNewCompanyAddress1("");
      setNewCompanyAddress2("");
      setNewCompanyPostalCode("");
      setNewCompanyCity("");
      setNewCompanyCountry("");
      setNewCompanyPhone("");
      setNewCompanyPlan("Bas");
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      setAdminPassword("");
      fetchCompanies();
    } catch (err: any) {
      console.error("Error creating company:", err);
      toast.error(err.message || "Kunde inte skapa företag");
    } finally {
      setCreating(false);
    }
  };

  const updateCompany = async () => {
    if (!editingCompany) return;
    setSaving(true);
    try {
      await apiFetch(`/companies/${editingCompany.id}`, {
        method: "PUT",
        json: {
          name: editingCompany.name,
          billing_email: editingCompany.billing_email,
          code: editingCompany.code,
          plan: editingCompany.plan || "Bas",
        },
      });
      toast.success("Företag uppdaterat");
      setEditingCompany(null);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte uppdatera företag");
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Ta bort ${companyName}? Detta går inte att ångra.`)) return;
    try {
      await apiFetch(`/companies/${companyId}`, { method: "DELETE" });
      toast.success("Företag borttaget");
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort företag");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Företagskod kopierad");
  };

  const periodDates = useMemo(() => {
    const [year, month] = selectedPeriod.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return { start: startOfMonth(date), end: endOfMonth(date) };
  }, [selectedPeriod]);

  const nextPeriodDates = useMemo(() => {
    const next = addMonths(periodDates.start, 1);
    return { start: startOfMonth(next), end: endOfMonth(next) };
  }, [periodDates.start]);

  const monthLabel = format(periodDates.start, "MMMM yyyy", { locale: sv });
  const nextMonthLabel = format(nextPeriodDates.start, "MMMM yyyy", { locale: sv });

  const billingSummary = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        company_id: string;
        company_name: string;
        total: number;
        adminCount: number;
        userCount: number;
        userFullPrice: number;
        userDiscounted: number;
        fullPrice: number;
        discounted: number;
        activeTotal: number;
        activeAdmins: number;
        activeUsers: number;
      }
    >();

    companies.forEach((company) => {
      summaryMap.set(String(company.id), {
        company_id: String(company.id),
        company_name: company.name,
        total: 0,
        adminCount: 0,
        userCount: 0,
        userFullPrice: 0,
        userDiscounted: 0,
        fullPrice: 0,
        discounted: 0,
        activeTotal: 0,
        activeAdmins: 0,
        activeUsers: 0,
      });
    });

    billingUsers.forEach((user) => {
      if (!user.company_id) return;
      const role = String(user.role || "user").toLowerCase();
      if (role === "super_admin") return;

      const { createdAt, intervals } = buildActiveIntervals(user);
      if (!createdAt) return;

      const key = String(user.company_id);
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          company_id: key,
          company_name: `Bolag ${key}`,
          total: 0,
          adminCount: 0,
          userCount: 0,
          userFullPrice: 0,
          userDiscounted: 0,
          fullPrice: 0,
          discounted: 0,
          activeTotal: 0,
          activeAdmins: 0,
          activeUsers: 0,
        });
      }
      const entry = summaryMap.get(key)!;
      const createdInPeriod =
        createdAt >= periodDates.start && createdAt <= periodDates.end;
      const wasActiveInPeriod = intervals.some((interval) =>
        intervalOverlaps(interval.start, interval.end, periodDates.start, periodDates.end)
      );

      if (createdInPeriod) {
        entry.total += 1;
      }

      if (wasActiveInPeriod && isActiveOnDate(intervals, nextPeriodDates.start)) {
        entry.activeTotal += 1;
        if (role === "admin") entry.activeAdmins += 1;
        else entry.activeUsers += 1;
      }

      if (!wasActiveInPeriod) return;

      if (role === "admin") {
        entry.adminCount += 1;
        entry.fullPrice += 1;
      } else {
        entry.userCount += 1;
        if (createdInPeriod && createdAt.getDate() > 15) {
          entry.userDiscounted += 1;
          entry.discounted += 1;
        } else {
          entry.userFullPrice += 1;
          entry.fullPrice += 1;
        }
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => a.company_name.localeCompare(b.company_name, "sv-SE"));
  }, [billingUsers, companies, nextPeriodDates.start, periodDates.end, periodDates.start]);

  const formatBillable = (value: number) => {
    if (Number.isNaN(value)) return "0";
    return value % 1 === 0 ? String(Math.trunc(value)) : value.toFixed(1);
  };

  const findOperoCompany = () =>
    companies.find((c) => (c.name || "").toLowerCase() === "opero systems ab") ||
    companies.find((c) => (c.name || "").toLowerCase() === "opero-system ab") ||
    companies[0];

  const handleGenerateSubscriptionInvoice = async (item: {
    company_id: string;
    company_name: string;
    adminCount: number;
    userFullPrice: number;
    userDiscounted: number;
  }) => {
    if (invoiceLoadingId) return;
    const targetCompany = companies.find((c) => String(c.id) === String(item.company_id));
    if (!targetCompany) {
      toast.error("Kunde inte hitta företaget.");
      return;
    }
    const issuerCompany = findOperoCompany();
    if (!issuerCompany) {
      toast.error("Opero Systems AB saknas i företagslistan.");
      return;
    }

    const lines: InvoiceLine[] = [];
    let itemIndex = 1;
    if (item.adminCount > 0) {
      lines.push({
        item_no: String(itemIndex++),
        description: "Admin (månadsavgift)",
        quantity: item.adminCount,
        unit: "st",
        unit_price: 250,
        total: item.adminCount * 250,
      });
    }
    if (item.userFullPrice > 0) {
      lines.push({
        item_no: String(itemIndex++),
        description: "Användare (månadsavgift)",
        quantity: item.userFullPrice,
        unit: "st",
        unit_price: 160,
        total: item.userFullPrice * 160,
      });
    }
    if (item.userDiscounted > 0) {
      lines.push({
        item_no: String(itemIndex++),
        description: "Användare (50% rabatt efter 15:e)",
        quantity: item.userDiscounted,
        unit: "st",
        unit_price: 80,
        total: item.userDiscounted * 80,
      });
    }

    if (!lines.length) {
      toast.error("Ingen faktura att skapa för vald period.");
      return;
    }

    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const vatRate = 25;
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    const totals: InvoiceTotals = {
      subtotal,
      vat,
      total,
      vat_rate: vatRate,
    };

    const customerLines: string[] = [];
    if (targetCompany.name) customerLines.push(targetCompany.name);
    if (targetCompany.address_line1) customerLines.push(targetCompany.address_line1);
    if (targetCompany.address_line2) customerLines.push(targetCompany.address_line2);
    const postalCity = [targetCompany.postal_code, targetCompany.city].filter(Boolean).join(" ");
    if (postalCity) customerLines.push(postalCity);
    if (targetCompany.country) customerLines.push(targetCompany.country);

    const invoiceDate = periodDates.end;
    const paymentTerms = issuerCompany.invoice_payment_terms?.trim() || "30 dagar";
    const numericDaysMatch = paymentTerms.match(/\d+/);
    const paymentDays = numericDaysMatch ? Number(numericDaysMatch[0]) : 30;
    const dueDate = addDays(invoiceDate, Number.isFinite(paymentDays) ? paymentDays : 30);
    const invoiceNumber = `${format(periodDates.start, "yyyyMM")}${item.company_id}`;
    const ocr = invoiceNumber ? `${invoiceNumber}0` : "";

    const meta: InvoiceMeta = {
      invoice_date: format(invoiceDate, "yyyy-MM-dd"),
      invoice_number: invoiceNumber,
      ocr,
      customer_number: targetCompany.code || String(targetCompany.id || ""),
      our_reference: issuerCompany.invoice_our_reference || "Opero Systems AB",
      their_reference: "",
      order_number: `Abonnemang ${monthLabel}`,
      payment_terms: paymentTerms,
      due_date: format(dueDate, "yyyy-MM-dd"),
      vat_number: targetCompany.vat_number || targetCompany.org_number || "",
      late_interest: issuerCompany.invoice_late_interest || "8%",
      customer_address_lines: customerLines,
    };

    const footer: CompanyFooter = {
      name: issuerCompany.name,
      address_line1: issuerCompany.address_line1,
      address_line2: issuerCompany.address_line2,
      postal_code: issuerCompany.postal_code,
      city: issuerCompany.city,
      country: issuerCompany.country,
      phone: issuerCompany.phone,
      billing_email: issuerCompany.billing_email,
      bankgiro: issuerCompany.bankgiro,
      bic_number: issuerCompany.bic_number,
      iban_number: issuerCompany.iban_number,
      logo_url: issuerCompany.logo_url,
      org_number: issuerCompany.org_number,
      vat_number: issuerCompany.vat_number,
      f_skatt: issuerCompany.f_skatt,
    };

    setInvoiceLoadingId(String(item.company_id));
    try {
      await generateInvoicePdf(meta, lines, totals, footer);
      toast.success(`Faktura skapad för ${item.company_name}.`);
    } catch (err: any) {
      toast.error(err.message || "Kunde inte skapa faktura-PDF.");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const totalNewUsers = billingSummary.reduce((sum, item) => sum + item.total, 0);
  const totalFullPrice = billingSummary.reduce((sum, item) => sum + item.fullPrice, 0);
  const totalDiscounted = billingSummary.reduce((sum, item) => sum + item.discounted, 0);
  const totalBillable = billingSummary.reduce((sum, item) => sum + item.fullPrice + item.discounted * 0.5, 0);
  const totalCarryover = billingSummary.reduce((sum, item) => sum + item.activeTotal, 0);

  const sendAi = async () => {
    const content = aiInput.trim();
    if (!content || aiLoading) return;

    const nextMessages = [...aiMessages, { role: "user", content }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await apiFetch<{ reply?: string }>("/superadmin/ai", {
        method: "POST",
        json: { messages: nextMessages },
      });
      const reply = String(res?.reply || "").trim() || "Inget svar från AI.";
      setAiMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast.error(err.message || "AI-felsökning misslyckades");
      setAiMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "Kunde inte nå AI-tjänsten. Kontrollera nyckel och server.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              Systemadministration
            </span>
            <h1 className="text-3xl font-semibold">Super Admin</h1>
            <p className="text-sm text-slate-400">Hantera företag, admins och operativa inställningar.</p>
          </div>
          <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30">
                <Plus className="h-4 w-4 mr-2" />
                Nytt företag
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-blue-200">Skapa nytt företag + admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-blue-200">Företagsnamn</Label>
                <Input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Företag AB"
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Faktura-email</Label>
                <Input
                  type="email"
                  value={newCompanyBillingEmail}
                  onChange={(e) => setNewCompanyBillingEmail(e.target.value)}
                  placeholder="faktura@foretag.se"
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Plan</Label>
                <Select value={newCompanyPlan} onValueChange={setNewCompanyPlan}>
                  <SelectTrigger className="border-slate-800 bg-slate-950/70 text-slate-100">
                    <SelectValue placeholder="Välj plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-blue-200">Organisationsnr</Label>
                  <Input
                    value={newCompanyOrgNumber}
                    onChange={(e) => {
                      const orgNumber = e.target.value;
                      setNewCompanyOrgNumber(orgNumber);
                      setNewCompanyVatNumber(formatVatNumber(orgNumber));
                    }}
                    placeholder="559999-9999"
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-200">Momsreg. nr</Label>
                  <Input
                    value={newCompanyVatNumber}
                    onChange={(e) => setNewCompanyVatNumber(formatVatNumber(e.target.value))}
                    placeholder="SE559999999901"
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Fakturaadress</Label>
                <Input
                  value={newCompanyAddress1}
                  onChange={(e) => setNewCompanyAddress1(e.target.value)}
                  placeholder="Gatuadress"
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Fakturaadress 2</Label>
                <Input
                  value={newCompanyAddress2}
                  onChange={(e) => setNewCompanyAddress2(e.target.value)}
                  placeholder="C/O, våning, etc."
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-blue-200">Postnr</Label>
                  <Input
                    value={newCompanyPostalCode}
                    onChange={(e) => setNewCompanyPostalCode(e.target.value)}
                    placeholder="123 45"
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-200">Ort</Label>
                  <Input
                    value={newCompanyCity}
                    onChange={(e) => setNewCompanyCity(e.target.value)}
                    placeholder="Stad"
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-200">Land</Label>
                  <Input
                    value={newCompanyCountry}
                    onChange={(e) => setNewCompanyCountry(e.target.value)}
                    placeholder="Sverige"
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Telefon</Label>
                <Input
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                  placeholder="070..."
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-blue-200">Admin förnamn</Label>
                  <Input
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-200">Admin efternamn</Label>
                  <Input
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Admin e-post</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Admin lösenord</Label>
                <Input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Starkt lösenord"
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewCompanyDialog(false)}>
                  Avbryt
                </Button>
                <Button onClick={createCompany} disabled={creating}>
                  {creating ? "Skapar..." : "Skapa företag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.6)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Totalt antal företag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-semibold">{companies.length}</span>
                  <p className="text-xs text-slate-400">Aktiva kunder i systemet</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100 shadow-[0_20px_60px_-40px_rgba(34,197,94,0.5)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Totalt antal användare</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-semibold">{companies.reduce((sum, c) => sum + (c.user_count || 0), 0)}</span>
                  <p className="text-xs text-slate-400">Inkluderar admins och användare</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100 shadow-[0_20px_60px_-40px_rgba(129,140,248,0.5)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Skapade sista veckan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-semibold">
                    {companies.filter((c) => c.created_at && new Date(c.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                  </span>
                  <p className="text-xs text-slate-400">Nya bolag senaste 7 dagarna</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100">
          <CardHeader>
            <CardTitle>Planinställningar</CardTitle>
            <CardDescription className="text-slate-400">
              Välj vilka sidor och funktioner som ingår i varje paket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {planSettingsLoading ? (
              <p className="text-sm text-slate-400">Laddar planinställningar...</p>
            ) : (
              <Tabs value={activePlanTab} onValueChange={setActivePlanTab} className="space-y-4">
                <TabsList className="bg-slate-950/70 border border-slate-800">
                  {PLAN_OPTIONS.map((plan) => (
                    <TabsTrigger key={plan.value} value={plan.value}>
                      {plan.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PLAN_OPTIONS.map((plan) => {
                  const selected = planSettings[plan.value] || [];
                  return (
                    <TabsContent key={plan.value} value={plan.value} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {FEATURE_OPTIONS.map((feature) => {
                          const id = `${plan.value}-${feature.key}`;
                          return (
                            <label
                              key={id}
                              htmlFor={id}
                              className="flex items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-sm"
                            >
                              <Checkbox
                                id={id}
                                checked={selected.includes(feature.key)}
                                onCheckedChange={() => togglePlanFeature(plan.value, feature.key)}
                              />
                              <span className="text-slate-200">{feature.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex flex-col gap-2 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
                        <span>Valda funktioner: {selected.length}</span>
                        <Button
                          onClick={() => savePlanSettings(plan.value)}
                          disabled={planSettingsSaving[plan.value]}
                        >
                          {planSettingsSaving[plan.value] ? "Sparar..." : "Spara plan"}
                        </Button>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>Fakturering – {monthLabel}</CardTitle>
                <CardDescription className="text-slate-400">
                  Fakturering sker sista dagen i månaden. Nya användare efter den 15:e faktureras med 50% rabatt.
                </CardDescription>
              </div>
              <div className="w-full md:w-64 space-y-1">
                <Label className="text-xs uppercase text-slate-400">Period</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="border-slate-800 bg-slate-950/70 text-slate-100">
                    <SelectValue placeholder="Välj period" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase text-slate-400">Tillagda användare</p>
                <p className="text-2xl font-semibold">{totalNewUsers}</p>
                <p className="text-xs text-slate-500">Vald period</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase text-slate-400">Fullpris</p>
                <p className="text-2xl font-semibold">{totalFullPrice}</p>
                <p className="text-xs text-slate-500">Admins + skapade t.o.m 15:e</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase text-slate-400">50% rabatt</p>
                <p className="text-2xl font-semibold">{totalDiscounted}</p>
                <p className="text-xs text-slate-500">Skapade efter 15:e</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase text-slate-400">Faktureras</p>
                <p className="text-2xl font-semibold">{formatBillable(totalBillable)}</p>
                <p className="text-xs text-slate-500">Användare (vägt)</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase text-slate-400">Kvar nästa månad</p>
                <p className="text-2xl font-semibold">{totalCarryover}</p>
                <p className="text-xs text-slate-500">{nextMonthLabel}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="text-slate-200">
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">Företag</TableHead>
                    <TableHead className="text-slate-400">Nya användare</TableHead>
                    <TableHead className="text-slate-400">Användartyper</TableHead>
                    <TableHead className="text-slate-400">Fullpris</TableHead>
                    <TableHead className="text-slate-400">50% rabatt</TableHead>
                    <TableHead className="text-slate-400">Kvar nästa månad</TableHead>
                    <TableHead className="text-slate-400">Faktura vald period</TableHead>
                    <TableHead className="text-slate-400">Faktura PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingSummary.map((item) => {
                    const billable = item.fullPrice + item.discounted * 0.5;
                    const roleSummary = `Admin ${item.adminCount} • Användare ${item.userCount}`;
                    const carryoverSummary = `Admin ${item.activeAdmins} • Användare ${item.activeUsers}`;
                    return (
                      <TableRow key={item.company_id} className="border-slate-800">
                        <TableCell className="font-medium">{item.company_name}</TableCell>
                        <TableCell>{item.total}</TableCell>
                        <TableCell className="text-sm text-slate-400">{roleSummary || "—"}</TableCell>
                        <TableCell>{item.fullPrice}</TableCell>
                        <TableCell>{item.discounted}</TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {item.activeTotal}
                          <div className="text-xs text-slate-500">{carryoverSummary}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {billable === 0
                            ? "Ingen faktura för vald period"
                            : `${monthLabel} får ${item.company_name} faktura för ${formatBillable(billable)} användare`}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-700 text-slate-200 hover:text-slate-900"
                            onClick={() =>
                              handleGenerateSubscriptionInvoice({
                                company_id: item.company_id,
                                company_name: item.company_name,
                                adminCount: item.adminCount,
                                userFullPrice: item.userFullPrice,
                                userDiscounted: item.userDiscounted,
                              })
                            }
                            disabled={billable === 0 || invoiceLoadingId === String(item.company_id)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {invoiceLoadingId === String(item.company_id) ? "Skapar..." : "Faktura"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100">
          <CardHeader>
            <CardTitle>Alla företag</CardTitle>
            <CardDescription className="text-slate-400">Hantera företag och tillhörande admins</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="text-slate-200">
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Företag</TableHead>
                  <TableHead className="text-slate-400">Faktura-email</TableHead>
                  <TableHead className="text-slate-400">Plan</TableHead>
                  <TableHead className="text-slate-400">Kod</TableHead>
                  <TableHead className="text-slate-400">Användare</TableHead>
                  <TableHead className="text-slate-400">Skapat</TableHead>
                  <TableHead className="text-slate-400">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} className="border-slate-800">
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-sm text-slate-400">{company.billing_email || "-"}</TableCell>
                    <TableCell className="text-sm text-slate-300">{company.plan || "Bas"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-slate-800/70 px-2 py-1 rounded text-slate-200">{company.code || "—"}</code>
                        {company.code && (
                          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-100" onClick={() => copyCode(company.code!)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{company.user_count || 0}</TableCell>
                    <TableCell>{company.created_at ? new Date(company.created_at).toLocaleDateString("sv-SE") : "-"}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" className="border-slate-700 text-slate-200 hover:text-slate-900" onClick={() => setEditingCompany(company)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Redigera
                      </Button>
                      <Button variant="outline" size="sm" className="border-rose-500/50 text-rose-300 hover:text-rose-700" onClick={() => deleteCompany(company.id, company.name)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Ta bort
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-blue-200">Redigera företag</DialogTitle>
          </DialogHeader>
          {editingCompany && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-blue-200">Företagsnamn</Label>
                <Input
                  value={editingCompany.name}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Faktura-email</Label>
                <Input
                  value={editingCompany.billing_email || ""}
                  onChange={(e) => setEditingCompany({ ...editingCompany, billing_email: e.target.value })}
                  placeholder="faktura@foretag.se"
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Företagskod</Label>
                <Input
                  value={editingCompany.code || ""}
                  onChange={(e) => setEditingCompany({ ...editingCompany, code: e.target.value })}
                  placeholder="t.ex. ABC123"
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Plan</Label>
                <Select
                  value={editingCompany.plan || "Bas"}
                  onValueChange={(value) => setEditingCompany({ ...editingCompany, plan: value })}
                >
                  <SelectTrigger className="border-slate-800 bg-slate-950/70 text-slate-100">
                    <SelectValue placeholder="Välj plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-200">Företagsadmin</Label>
                {loadingAdmins ? (
                  <p className="text-sm text-slate-400">Laddar admin-användare...</p>
                ) : adminUsers.length === 0 ? (
                  <p className="text-sm text-slate-400">Inga admin-användare hittades.</p>
                ) : (
                  <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUsers.map((admin) => (
                        <SelectItem key={admin.id} value={String(admin.id)}>
                          {admin.full_name || admin.email}
                          {admin.is_active === 0 ? " (Inaktiv)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-blue-200">Admin namn</Label>
                  <Input
                    value={adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.full_name || ""}
                    readOnly
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-200">Admin e-post</Label>
                  <Input
                    value={adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.email || ""}
                    readOnly
                    className="text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => setResetDialogOpen(true)}
                  disabled={!selectedAdminId || loadingAdmins}
                >
                  Återställ lösenord
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>
              Avbryt
            </Button>
            <Button onClick={updateCompany} disabled={!editingCompany || saving}>
              {saving ? "Sparar..." : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 text-blue-200 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-blue-200">Återställ lösenord</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-blue-300/70">
            Generera ett nytt lösenord för{" "}
            {adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.full_name ||
              adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.email}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleResetAdminPassword} disabled={loadingAdmins || !selectedAdminId}>
              {loadingAdmins ? "Genererar..." : "Generera nytt lösenord"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (open) setPasswordDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md [&>button]:hidden bg-slate-950 text-blue-200 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-blue-200">{passwordDialogTitle}</DialogTitle>
            <DialogDescription className="text-blue-300/70">{passwordDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="generated-password" className="text-blue-200">Genererat lösenord</Label>
            <Input id="generated-password" value={passwordDialogValue} readOnly className="font-mono" />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setPasswordDialogOpen(false);
                setPasswordDialogValue("");
                setPasswordDialogDescription("");
                setPasswordDialogTitle("");
              }}
            >
              Jag har sparat lösenord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100">
        <CardHeader>
          <CardTitle>AI-felsökare</CardTitle>
          <CardDescription className="text-slate-400">Klistra in felkod/logg för snabb hjälp (endast Super Admin).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-56 rounded-md border border-slate-800 bg-slate-950/60">
            <div className="space-y-3 p-3">
              {aiMessages.length === 0 && (
                <p className="text-sm text-slate-400">
                  Ingen historik ännu. Lägg in en felkod eller beskrivning.
                </p>
              )}
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-md bg-slate-900/80 p-3 shadow-sm">
                  <p className="text-xs uppercase text-slate-500">
                    {message.role === "user" ? "Du" : "AI"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              ))}
              <div ref={aiEndRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Label>Felkod eller problem</Label>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ex: 404 Not Found på /auth/me efter lösenordsbyte..."
              rows={4}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              AI svarar utifrån det du klistrar in – dela inte känsliga uppgifter.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAiMessages([])}
                disabled={aiLoading || aiMessages.length === 0}
              >
                Rensa
              </Button>
              <Button onClick={sendAi} disabled={aiLoading || !aiInput.trim()}>
                {aiLoading ? "Analyserar..." : "Analysera"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
};

export default SuperAdminDashboard;
