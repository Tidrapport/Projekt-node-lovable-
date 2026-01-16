import type { ComponentType } from "react";
import {
  Home,
  Clock,
  AlertTriangle,
  FolderKanban,
  Users,
  Briefcase,
  Package,
  CheckSquare,
  ClipboardCheck,
  AlertCircle,
  Percent,
  DollarSign,
  BarChart3,
  Calendar,
  FileText,
  Wallet,
  ClipboardList,
  BadgeCheck,
  Contact,
  Key,
} from "lucide-react";

export type MenuSectionKey = "user" | "admin_main" | "admin_hub";

export type MenuSettings = Partial<Record<MenuSectionKey, string[]>>;

export type MenuItem = {
  id: string;
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  feature?: string;
};

export type MenuSection = {
  key: MenuSectionKey;
  label: string;
  items: MenuItem[];
};

export const USER_MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", title: "Översikt", url: "/", icon: Home, feature: "dashboard" },
  { id: "time_reports", title: "Tidrapporter", url: "/time-reports", icon: Clock, feature: "time_reports" },
  { id: "work_orders", title: "Arbetsordrar", url: "/work-orders", icon: ClipboardList, feature: "work_orders" },
  { id: "welding_reports", title: "Svetsrapport", url: "/welding-report", icon: Briefcase, feature: "welding_reports" },
  { id: "planning", title: "Planering", url: "/planning", icon: Calendar, feature: "planning" },
  { id: "deviations", title: "Avvikelser", url: "/deviations", icon: AlertTriangle, feature: "deviations" },
  { id: "self_checks", title: "Egenkontroll", url: "/self-checks", icon: ClipboardCheck, feature: "self_checks" },
  { id: "salary_overview", title: "Lönöversikt", url: "/salary-overview", icon: DollarSign, feature: "salary_overview" },
  { id: "contacts", title: "Kontakter", url: "/contacts", icon: Contact, feature: "contacts" },
  { id: "documents", title: "Dokument", url: "/documents", icon: FileText, feature: "documents" },
  { id: "change_password", title: "Byt lösenord", url: "/change-password", icon: Key },
];

export const ADMIN_MAIN_ITEMS: MenuItem[] = [
  { id: "statistics", title: "Statistik", url: "/admin/statistics", icon: BarChart3, feature: "statistics" },
  { id: "work_orders", title: "Arbetsorder", url: "/admin/work-orders", icon: ClipboardList, feature: "work_orders" },
  { id: "attestation", title: "Attestering", url: "/admin/attestations", icon: CheckSquare, feature: "attestation" },
  { id: "billing", title: "Fakturering", url: "/admin/billing", icon: FileText, feature: "billing" },
  { id: "invoice_marking", title: "Fakturering markera", url: "/admin/invoice-marking", icon: BadgeCheck, feature: "invoice_marking" },
  { id: "salaries", title: "Löner", url: "/admin/salaries", icon: Wallet, feature: "salaries" },
  { id: "welding_reports", title: "Svetsrapporter", url: "/admin/welding-reports", icon: Briefcase, feature: "welding_reports" },
  { id: "planning", title: "Resursplanering", url: "/admin/planning", icon: Calendar, feature: "planning" },
  { id: "deviations", title: "Avvikelser", url: "/admin/deviations", icon: AlertCircle, feature: "deviations" },
  { id: "self_checks", title: "Egenkontroll", url: "/admin/self-checks", icon: ClipboardCheck, feature: "self_checks" },
  { id: "customers", title: "Kunder", url: "/admin/customers", icon: Users, feature: "customers" },
  { id: "offers", title: "Offerter", url: "/admin/offers", icon: FileText, feature: "offers" },
  { id: "projects", title: "Projekt", url: "/admin/projects", icon: FolderKanban, feature: "projects" },
];

export const ADMIN_HUB_ITEMS: MenuItem[] = [
  { id: "admin_hub", title: "Mitt Företag", url: "/admin/hub", icon: FileText, feature: "admin_hub" },
  { id: "admin_users", title: "Användare", url: "/admin/users", icon: Users, feature: "admin_users" },
  { id: "job_roles", title: "Yrkesroller", url: "/admin/job-roles", icon: Briefcase, feature: "job_roles" },
  { id: "material_types", title: "Tillägg", url: "/admin/material-types", icon: Package, feature: "material_types" },
  { id: "ob_settings", title: "OB-inställningar", url: "/admin/ob-settings", icon: Percent, feature: "ob_settings" },
  { id: "invoice_settings", title: "Integrationer", url: "/admin/invoice-settings", icon: FileText, feature: "invoice_settings" },
  { id: "price_list", title: "Prislista", url: "/admin/price-list", icon: FileText, feature: "price_list" },
  { id: "documents", title: "Dokument", url: "/admin/documents", icon: FileText, feature: "documents" },
  { id: "time_report_settings", title: "Tidrapporteringsinställningar", url: "/admin/time-report-settings", icon: Clock, feature: "time_report_settings" },
  { id: "menu_settings", title: "Meny inställning", url: "/admin/menu-settings", icon: FileText, feature: "menu_settings" },
  { id: "activity_log", title: "Aktivitetslogg", url: "/admin/activity-log", icon: ClipboardList, feature: "activity_log" },
];

export const MENU_SECTIONS: MenuSection[] = [
  { key: "user", label: "Användare", items: USER_MENU_ITEMS },
  { key: "admin_main", label: "Administration", items: ADMIN_MAIN_ITEMS },
  { key: "admin_hub", label: "AdminHub", items: ADMIN_HUB_ITEMS },
];

export const applyMenuOrder = (items: MenuItem[], order?: string[] | null) => {
  if (!order || order.length === 0) return items;
  const map = new Map(items.map((item) => [item.id, item]));
  const ordered: MenuItem[] = [];
  order.forEach((id) => {
    const match = map.get(id);
    if (!match) return;
    ordered.push(match);
    map.delete(id);
  });
  map.forEach((item) => ordered.push(item));
  return ordered;
};

export const buildMenuOrderIds = (items: MenuItem[], order?: string[] | null) => {
  const available = new Set(items.map((item) => item.id));
  const seen = new Set<string>();
  const result: string[] = [];
  (order || []).forEach((id) => {
    if (!available.has(id) || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  items.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    result.push(item.id);
  });
  return result;
};
