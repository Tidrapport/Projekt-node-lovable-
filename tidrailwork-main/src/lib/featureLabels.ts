export const FEATURE_OPTIONS = [
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

export const FEATURE_LABELS = FEATURE_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});
