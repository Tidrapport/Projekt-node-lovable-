import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GuideButton } from "@/components/GuideButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Download } from "lucide-react";

type JobRoleRate = {
  id: string;
  name: string;
  article_number: string;
  day_article_number: string;
  evening_article_number: string;
  night_article_number: string;
  weekend_article_number: string;
  overtime_weekday_article_number: string;
  overtime_weekend_article_number: string;
  per_diem_article_number: string;
  travel_time_article_number: string;
  day_rate: string;
  evening_rate: string;
  night_rate: string;
  weekend_rate: string;
  overtime_weekday_rate: string;
  overtime_weekend_rate: string;
  per_diem_rate: string;
  travel_time_rate: string;
};

type MaterialRate = {
  id: string;
  name: string;
  article_number: string;
  price: string;
  unit: string;
};

type Project = {
  id: string;
  name: string;
};

type FortnoxArticle = {
  article_number: string;
  description: string;
  unit?: string;
};

type PriceListSettings = {
  show_day: boolean;
  show_evening: boolean;
  show_night: boolean;
  show_weekend: boolean;
  show_overtime_weekday: boolean;
  show_overtime_weekend: boolean;
  day_start: string;
  day_end: string;
  evening_start: string;
  evening_end: string;
  night_start: string;
  night_end: string;
  weekend_start: string;
  weekend_end: string;
};

const UNIT_OPTIONS = [
  { value: "styck", label: "Styck" },
  { value: "mil", label: "Mil" },
  { value: "antal", label: "Antal" },
  { value: "liter", label: "Liter" },
  { value: "skift", label: "Skift" },
];

const toRateString = (value?: number | null) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const normalizeUnit = (value: string | null | undefined) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (UNIT_OPTIONS.some((opt) => opt.value === normalized)) return normalized;
  return "styck";
};

const normalizeArticleKey = (value: string) => {
  const raw = String(value || "").trim().toLowerCase();
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
};

const DEFAULT_SETTINGS: PriceListSettings = {
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

const normalizeSettings = (value: any): PriceListSettings => ({
  show_day: Boolean(value?.show_day ?? DEFAULT_SETTINGS.show_day),
  show_evening: Boolean(value?.show_evening ?? DEFAULT_SETTINGS.show_evening),
  show_night: Boolean(value?.show_night ?? DEFAULT_SETTINGS.show_night),
  show_weekend: Boolean(value?.show_weekend ?? DEFAULT_SETTINGS.show_weekend),
  show_overtime_weekday: Boolean(value?.show_overtime_weekday ?? DEFAULT_SETTINGS.show_overtime_weekday),
  show_overtime_weekend: Boolean(value?.show_overtime_weekend ?? DEFAULT_SETTINGS.show_overtime_weekend),
  day_start: value?.day_start || DEFAULT_SETTINGS.day_start,
  day_end: value?.day_end || DEFAULT_SETTINGS.day_end,
  evening_start: value?.evening_start || DEFAULT_SETTINGS.evening_start,
  evening_end: value?.evening_end || DEFAULT_SETTINGS.evening_end,
  night_start: value?.night_start || DEFAULT_SETTINGS.night_start,
  night_end: value?.night_end || DEFAULT_SETTINGS.night_end,
  weekend_start: value?.weekend_start || DEFAULT_SETTINGS.weekend_start,
  weekend_end: value?.weekend_end || DEFAULT_SETTINGS.weekend_end,
});

const formatRate = (value: string) => {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toFixed(2);
};

const PriceList = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("standard");
  const [jobRoles, setJobRoles] = useState<JobRoleRate[]>([]);
  const [materials, setMaterials] = useState<MaterialRate[]>([]);
  const [settings, setSettings] = useState<PriceListSettings>(DEFAULT_SETTINGS);
  const [settingsSource, setSettingsSource] = useState<string>("default");
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const providerLabels: Record<string, string> = {
    fortnox: "Fortnox",
    visma: "Visma",
    speedledger: "SpeedLedger",
    bjornlunden: "Björn Lunden",
  };

  const yearOptions = useMemo(() => {
    return Array.from({ length: 5 }, (_, idx) => String(currentYear - 2 + idx));
  }, [currentYear]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const loadPriceList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (selectedProjectId !== "standard") {
        params.set("project_id", selectedProjectId);
      }
      const data = await apiFetch<any>(`/price-list?${params.toString()}`);
      const jobRolesData = ensureArray(data?.job_roles).map((role: any) => ({
        id: String(role.id),
        name: role.name || "-",
        article_number: String(role.article_number || ""),
        day_article_number: String(role.day_article_number || ""),
        evening_article_number: String(role.evening_article_number || ""),
        night_article_number: String(role.night_article_number || ""),
        weekend_article_number: String(role.weekend_article_number || ""),
        overtime_weekday_article_number: String(role.overtime_weekday_article_number || ""),
        overtime_weekend_article_number: String(role.overtime_weekend_article_number || ""),
        per_diem_article_number: String(role.per_diem_article_number || ""),
        travel_time_article_number: String(role.travel_time_article_number || ""),
        day_rate: toRateString(role.day_rate),
        evening_rate: toRateString(role.evening_rate),
        night_rate: toRateString(role.night_rate),
        weekend_rate: toRateString(role.weekend_rate),
        overtime_weekday_rate: toRateString(role.overtime_weekday_rate),
        overtime_weekend_rate: toRateString(role.overtime_weekend_rate),
        per_diem_rate: toRateString(role.per_diem_rate),
        travel_time_rate: toRateString(role.travel_time_rate),
      }));

      const materialData = ensureArray(data?.material_types).map((item: any) => ({
        id: String(item.id),
        name: item.name || "-",
        article_number: String(item.article_number || ""),
        price: toRateString(item.price),
        unit: normalizeUnit(item.unit),
      }));

      setJobRoles(jobRolesData);
      setMaterials(materialData);
      setSettings(normalizeSettings(data?.settings));
      setSettingsSource(String(data?.settings_source || "default"));
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta prislista");
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await apiFetch<Project[]>("/projects?active=true");
      setProjects(ensureArray(data).map((p) => ({ id: String(p.id), name: p.name })));
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta projekt");
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadPriceList();
  }, [year, selectedProjectId]);

  const updateJobRoleRate = (id: string, field: keyof JobRoleRate, value: string) => {
    setJobRoles((prev) =>
      prev.map((role) => (role.id === id ? { ...role, [field]: value } : role))
    );
  };

  const updateMaterial = (id: string, field: keyof MaterialRate, value: string) => {
    setMaterials((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const updateSettings = (field: keyof PriceListSettings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const params = new URLSearchParams({ year });
      if (selectedProjectId !== "standard") {
        params.set("project_id", selectedProjectId);
      }
      await apiFetch(`/price-list?${params.toString()}`, {
        method: "PUT",
        json: {
          year: Number(year),
          job_roles: jobRoles.map((role) => ({
            id: role.id,
            article_number: role.article_number,
            day_article_number: role.day_article_number,
            evening_article_number: role.evening_article_number,
            night_article_number: role.night_article_number,
            weekend_article_number: role.weekend_article_number,
            overtime_weekday_article_number: role.overtime_weekday_article_number,
            overtime_weekend_article_number: role.overtime_weekend_article_number,
            per_diem_article_number: role.per_diem_article_number,
            travel_time_article_number: role.travel_time_article_number,
            day_rate: role.day_rate,
            evening_rate: role.evening_rate,
            night_rate: role.night_rate,
            weekend_rate: role.weekend_rate,
            overtime_weekday_rate: role.overtime_weekday_rate,
            overtime_weekend_rate: role.overtime_weekend_rate,
            per_diem_rate: role.per_diem_rate,
            travel_time_rate: role.travel_time_rate,
          })),
          material_types: materials.map((item) => ({
            id: item.id,
            article_number: item.article_number,
            price: item.price,
            unit: item.unit,
          })),
          settings: {
            show_day: settings.show_day,
            show_evening: settings.show_evening,
            show_night: settings.show_night,
            show_weekend: settings.show_weekend,
            show_overtime_weekday: settings.show_overtime_weekday,
            show_overtime_weekend: settings.show_overtime_weekend,
            day_start: settings.day_start,
            day_end: settings.day_end,
            evening_start: settings.evening_start,
            evening_end: settings.evening_end,
            night_start: settings.night_start,
            night_end: settings.night_end,
            weekend_start: settings.weekend_start,
            weekend_end: settings.weekend_end,
          },
        },
      });
      toast.success("Prislista sparad");
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara prislista");
    } finally {
      setSaving(false);
    }
  };

  const exportToPDF = async () => {
    if (jobRoles.length === 0 && materials.length === 0) {
      toast.error("Inga rader att exportera");
      return;
    }

    try {
      const doc = new jsPDF();
      const title =
        selectedProjectId === "standard"
          ? "Prislista - Standard"
          : `Prislista - ${selectedProject?.name || "Projekt"}`;

      doc.setFontSize(20);
      doc.text(title, 14, 18);
      doc.setFontSize(11);
      doc.text(`År: ${year}`, 14, 26);
      doc.text(`Exportdatum: ${new Date().toLocaleDateString("sv-SE")}`, 14, 33);

      let yPos = 42;

      if (jobRoles.length > 0) {
        doc.setFontSize(14);
        doc.text("Yrkesroller", 14, yPos);
        yPos += 4;

        autoTable(doc, {
          startY: yPos,
          head: [[
            "Yrkesroll",
            "Dag",
            "Kväll",
            "Natt",
            "Helg",
            "ÖT vardag",
            "ÖT helg",
            "Traktamente",
            "Restid",
          ]],
          body: jobRoles.map((role) => [
            role.name,
            formatRate(role.day_rate),
            formatRate(role.evening_rate),
            formatRate(role.night_rate),
            formatRate(role.weekend_rate),
            formatRate(role.overtime_weekday_rate),
            formatRate(role.overtime_weekend_rate),
            formatRate(role.per_diem_rate),
            formatRate(role.travel_time_rate),
          ]),
          styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
        });

        yPos = (doc as any).lastAutoTable?.finalY + 10;
      }

      if (materials.length > 0) {
        doc.setFontSize(14);
        doc.text("Tillägg", 14, yPos);
        yPos += 4;

        autoTable(doc, {
          startY: yPos,
          head: [["Artnr", "Tillägg", "Pris", "Enhet"]],
          body: materials.map((item) => [
            item.article_number || "-",
            item.name,
            formatRate(item.price),
            item.unit || "-",
          ]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [52, 152, 219], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 70 },
            2: { cellWidth: 30, halign: "right" },
            3: { cellWidth: 30 },
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

      const baseName = selectedProject?.name || "Standard";
      const safeName = baseName.replace(/[^a-zA-Z0-9_-]+/g, "_");
      doc.save(`prislista_${safeName}_${year}.pdf`);
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("Kunde inte skapa PDF");
    }
  };

  const clearExternalPriceList = async () => {
    if (selectedProjectId === "standard") return;
    try {
      await apiFetch(`/price-list?year=${year}&project_id=${selectedProjectId}`, {
        method: "DELETE",
      });
      toast.success("Extern prislista rensad");
      loadPriceList();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte rensa prislista");
    }
  };

  const syncArticlesFromProvider = async (provider: "fortnox" | "visma" | "speedledger" | "bjornlunden") => {
    if (provider !== "fortnox") {
      toast(`Stöd för ${providerLabels[provider] || provider} kommer snart.`);
      return;
    }

    setSyncingProvider(provider);
    try {
      const data = await apiFetch<{ articles: FortnoxArticle[] }>("/admin/fortnox/articles");
      const articles = ensureArray(data?.articles);
      if (!articles.length) {
        toast.error("Inga Fortnox-artiklar hittades.");
        return;
      }

      const articleMap = new Map<string, FortnoxArticle>();
      const normalizedArticles = articles
        .map((article) => {
          const key = normalizeArticleKey(article.description || article.article_number);
          return key ? { key, article } : null;
        })
        .filter(Boolean) as Array<{ key: string; article: FortnoxArticle }>;

      normalizedArticles.forEach((item) => {
        if (!articleMap.has(item.key)) articleMap.set(item.key, item.article);
      });

      const findArticleMatch = (name: string) => {
        const key = normalizeArticleKey(name);
        if (!key) return null;
        const exact = articleMap.get(key);
        if (exact) return exact;
        const candidates = normalizedArticles.filter(
          (item) => item.key.includes(key) || key.includes(item.key)
        );
        if (!candidates.length) return null;
        return candidates.reduce((best, current) => {
          if (!best) return current;
          return current.key.length < best.key.length ? current : best;
        }, null as null | { key: string; article: FortnoxArticle })?.article || null;
      };

      const findArticleMatchByKeywords = (roleKey: string, keywords: string[]) => {
        if (!roleKey) return null;
        const normalizedKeywords = keywords.map((kw) => normalizeArticleKey(kw)).filter(Boolean);
        let best: { key: string; article: FortnoxArticle } | null = null;
        let bestScore = 0;
        normalizedArticles.forEach((item) => {
          const hasRole = item.key.includes(roleKey);
          if (!hasRole) return;
          let keywordMatches = 0;
          if (normalizedKeywords.length) {
            normalizedKeywords.forEach((kw) => {
              if (kw && item.key.includes(kw)) keywordMatches += 1;
            });
            if (!keywordMatches) return;
          }
          const score = 2 + keywordMatches;
          if (score > bestScore) {
            bestScore = score;
            best = item;
          } else if (score === bestScore && best && item.key.length < best.key.length) {
            best = item;
          }
        });
        return best?.article || null;
      };

      const findGlobalArticleMatchByKeywords = (keywords: string[]) => {
        const normalizedKeywords = keywords.map((kw) => normalizeArticleKey(kw)).filter(Boolean);
        let best: { key: string; article: FortnoxArticle } | null = null;
        let bestScore = 0;
        normalizedArticles.forEach((item) => {
          let keywordMatches = 0;
          normalizedKeywords.forEach((kw) => {
            if (kw && item.key.includes(kw)) keywordMatches += 1;
          });
          if (!keywordMatches) return;
          const score = keywordMatches + 1;
          if (score > bestScore) {
            bestScore = score;
            best = item;
          } else if (score === bestScore && best && item.key.length < best.key.length) {
            best = item;
          }
        });
        return best?.article || null;
      };

      const perDiemFallback = findGlobalArticleMatchByKeywords(["traktamente", "perdiem", "per diem"]);
      const perDiemArticleNumber = perDiemFallback?.article_number?.trim() || "";

      let updatedRoles = 0;
      let updatedMaterials = 0;

      const nextRoles = jobRoles.map((role) => {
        const roleKey = normalizeArticleKey(role.name);
        const baseMatch = findArticleMatch(role.name);
        const baseArticleNumber = baseMatch?.article_number?.trim() || "";

        let changed = false;
        const fillField = (value: string, keywords: string[]) => {
          if (String(value || "").trim()) return value;
          const match = findArticleMatchByKeywords(roleKey, keywords) || baseMatch;
          const articleNumber = match?.article_number?.trim() || "";
          if (!articleNumber) return value;
          changed = true;
          return articleNumber;
        };

        const nextRole = {
          ...role,
          article_number: String(role.article_number || "").trim()
            ? role.article_number
            : baseArticleNumber,
          day_article_number: fillField(role.day_article_number, ["dag"]),
          evening_article_number: fillField(role.evening_article_number, ["kvall", "kväll"]),
          night_article_number: fillField(role.night_article_number, ["natt"]),
          weekend_article_number: fillField(role.weekend_article_number, ["helg", "weekend"]),
          overtime_weekday_article_number: fillField(role.overtime_weekday_article_number, [
            "overtidvardag",
            "övertidvardag",
            "otvardag",
            "övertid vardag",
            "ot vardag",
          ]),
          overtime_weekend_article_number: fillField(role.overtime_weekend_article_number, [
            "overtidhelg",
            "övertidhelg",
            "othelg",
            "övertid helg",
            "ot helg",
          ]),
          per_diem_article_number: String(role.per_diem_article_number || "").trim()
            ? role.per_diem_article_number
            : perDiemArticleNumber || fillField(role.per_diem_article_number, [
                "traktamente",
                "perdiem",
                "per diem",
              ]),
          travel_time_article_number: fillField(role.travel_time_article_number, ["restid", "resa", "resor"]),
        };

        if (nextRole.article_number !== role.article_number && baseArticleNumber) changed = true;
        if (changed) updatedRoles += 1;
        return nextRole;
      });

      const nextMaterials = materials.map((item) => {
        if (String(item.article_number || "").trim()) return item;
        const match = findArticleMatch(item.name);
        const articleNumber = match?.article_number?.trim() || "";
        if (!articleNumber) return item;
        updatedMaterials += 1;
        return { ...item, article_number: articleNumber };
      });

      setJobRoles(nextRoles);
      setMaterials(nextMaterials);

      const totalUpdates = updatedRoles + updatedMaterials;
      if (totalUpdates === 0) {
        toast("Inga matchningar hittades.");
      } else {
        toast.success(
          `Matchade ${totalUpdates} rader från Fortnox. Spara prislistan för att behålla ändringarna.`
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta Fortnox-artiklar");
    } finally {
      setSyncingProvider(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prislista</h1>
          <p className="text-muted-foreground">
            Skapa och hantera prislistor för fakturering.
          </p>
        </div>
        <GuideButton
          title="Guide: Prislista, OB och artiklar"
          steps={[
            "Välj år och om prislistan är standard eller projektspecifik.",
            "Ange pris per yrkesroll, OB, restid och traktamente.",
            "Matcha rader mot Fortnox-artiklar för korrekta artikelnummer.",
            "Spara prislistan innan fakturering eller export till Fortnox.",
            "Testa med en tidrapport och kontrollera fakturaraderna.",
          ]}
          note="För korrekt OB på faktura måste OB-inställningar och prislista vara synkade."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
          {selectedProjectId === "standard"
              ? "Standardprislista"
              : `Extern prislista – ${selectedProject?.name || "Projekt"}`}
          </CardTitle>
          <CardDescription>
            Prislista som gäller för valt år. Extern prislista kan anges per projekt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="space-y-2">
                <Label>År</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Välj år" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Projekt (extern prislista)</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Standardprislista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standardprislista</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProjectId !== "standard" && (
                  <p className="text-xs text-muted-foreground">
                    Tomma fält använder standardprislistan vid fakturering.
                  </p>
                )}
                {settingsSource === "standard" && selectedProjectId !== "standard" && (
                  <p className="text-xs text-muted-foreground">
                    Visar standardinställningar. Spara för att skapa projektets egna inställningar.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadPriceList} disabled={loading}>
                Uppdatera
              </Button>
              <Button variant="outline" onClick={exportToPDF} disabled={loading}>
                <Download className="h-4 w-4 mr-2" />
                Ladda ner PDF
              </Button>
              {selectedProjectId !== "standard" && (
                <Button variant="outline" onClick={clearExternalPriceList} disabled={loading}>
                  Rensa extern prislista
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? "Sparar..." : "Spara prislista"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kundunderlag – visning</CardTitle>
          <CardDescription>Välj vilka tidskategorier som ska visas i kundunderlaget.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.show_day}
                onCheckedChange={(value) => updateSettings("show_day", value === true)}
              />
              Visa dag
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.show_evening}
                onCheckedChange={(value) => updateSettings("show_evening", value === true)}
              />
              Visa kväll
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.show_night}
                onCheckedChange={(value) => updateSettings("show_night", value === true)}
              />
              Visa natt
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.show_weekend}
                onCheckedChange={(value) => updateSettings("show_weekend", value === true)}
              />
              Visa helg
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.show_overtime_weekday}
                onCheckedChange={(value) => updateSettings("show_overtime_weekday", value === true)}
              />
              Visa övertid vardag
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.show_overtime_weekend}
                onCheckedChange={(value) => updateSettings("show_overtime_weekend", value === true)}
              />
              Visa övertid helg
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Tidsintervallen styr hur timmar delas upp i kundunderlaget.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kundunderlag – tidsintervall</CardTitle>
          <CardDescription>Ställ in tider för dag, kväll, natt och helg.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Dag (start)</Label>
              <Input
                type="time"
                value={settings.day_start}
                onChange={(e) => updateSettings("day_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dag (slut)</Label>
              <Input
                type="time"
                value={settings.day_end}
                onChange={(e) => updateSettings("day_end", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kväll (start)</Label>
              <Input
                type="time"
                value={settings.evening_start}
                onChange={(e) => updateSettings("evening_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kväll (slut)</Label>
              <Input
                type="time"
                value={settings.evening_end}
                onChange={(e) => updateSettings("evening_end", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Natt (start)</Label>
              <Input
                type="time"
                value={settings.night_start}
                onChange={(e) => updateSettings("night_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Natt (slut)</Label>
              <Input
                type="time"
                value={settings.night_end}
                onChange={(e) => updateSettings("night_end", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Helg (start)</Label>
              <Input
                type="time"
                value={settings.weekend_start}
                onChange={(e) => updateSettings("weekend_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Helg (slut)</Label>
              <Input
                type="time"
                value={settings.weekend_end}
                onChange={(e) => updateSettings("weekend_end", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Yrkesroller</CardTitle>
              <CardDescription>Arvode och OB-priser per yrkesroll.</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={loading || !!syncingProvider}>
                  {syncingProvider ? "Hämtar artiklar..." : "Hämta artiklar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => syncArticlesFromProvider("fortnox")}>
                  Fortnox
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => syncArticlesFromProvider("visma")}>
                  Visma
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => syncArticlesFromProvider("speedledger")}>
                  SpeedLedger
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => syncArticlesFromProvider("bjornlunden")}>
                  Björn Lunden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {jobRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga yrkesroller att visa.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36 text-xs">Yrkesroll</TableHead>
                    <TableHead className="w-24 text-xs">Dag - Pris</TableHead>
                    <TableHead className="w-24 text-xs">Kväll - Pris</TableHead>
                    <TableHead className="w-24 text-xs">Natt - Pris</TableHead>
                    <TableHead className="w-24 text-xs">Helg - Pris</TableHead>
                    <TableHead className="w-24 text-xs">ÖT vardag - Pris</TableHead>
                    <TableHead className="w-24 text-xs">ÖT helg - Pris</TableHead>
                    <TableHead className="w-24 text-xs">Traktamente - Pris</TableHead>
                    <TableHead className="w-24 text-xs">Restid - Pris</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium text-sm align-top">{role.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.day_article_number}
                            onChange={(e) => updateJobRoleRate(role.id, "day_article_number", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.day_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "day_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.evening_article_number}
                            onChange={(e) => updateJobRoleRate(role.id, "evening_article_number", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.evening_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "evening_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.night_article_number}
                            onChange={(e) => updateJobRoleRate(role.id, "night_article_number", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.night_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "night_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.weekend_article_number}
                            onChange={(e) => updateJobRoleRate(role.id, "weekend_article_number", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.weekend_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "weekend_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.overtime_weekday_article_number}
                            onChange={(e) =>
                              updateJobRoleRate(role.id, "overtime_weekday_article_number", e.target.value)
                            }
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.overtime_weekday_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "overtime_weekday_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.overtime_weekend_article_number}
                            onChange={(e) =>
                              updateJobRoleRate(role.id, "overtime_weekend_article_number", e.target.value)
                            }
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.overtime_weekend_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "overtime_weekend_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.per_diem_article_number}
                            onChange={(e) => updateJobRoleRate(role.id, "per_diem_article_number", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.per_diem_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "per_diem_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-0">
                          <Input
                            value={role.travel_time_article_number}
                            onChange={(e) =>
                              updateJobRoleRate(role.id, "travel_time_article_number", e.target.value)
                            }
                            className="h-7 text-[11px] px-2"
                            placeholder="Artnr"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={role.travel_time_rate}
                            onChange={(e) => updateJobRoleRate(role.id, "travel_time_rate", e.target.value)}
                            className="h-7 text-[11px] px-2"
                            placeholder="Pris"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tillägg</CardTitle>
          <CardDescription>Fast pris per tillägg med vald enhet.</CardDescription>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga tillägg att visa.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artnr</TableHead>
                    <TableHead>Tillägg</TableHead>
                    <TableHead>Pris</TableHead>
                    <TableHead>Enhet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.article_number}
                          onChange={(e) => updateMaterial(item.id, "article_number", e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateMaterial(item.id, "price", e.target.value)}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateMaterial(item.id, "unit", value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Välj enhet" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PriceList;
