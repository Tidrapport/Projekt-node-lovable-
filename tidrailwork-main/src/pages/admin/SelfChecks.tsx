import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GuideButton } from "@/components/GuideButton";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";

type Project = {
  id: string | number;
  name: string;
  is_active: boolean;
};

type Subproject = {
  id: string | number;
  project_id: string | number;
  name: string;
  is_active: boolean;
};

type Requirement = {
  id?: string | number | null;
  project_id: string | number;
  subproject_id?: string | number | null;
  required: number;
};

type SelfCheckItem = {
  id: string | number;
  label: string;
  project_id?: string | number | null;
  subproject_id?: string | number | null;
  sort_order?: number;
  is_active?: number;
};

const AdminSelfChecks = () => {
  const { isSuperAdmin, companyId } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [items, setItems] = useState<SelfCheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<"active" | "completed">("active");
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [itemLabel, setItemLabel] = useState("");
  const [itemProjectId, setItemProjectId] = useState("_global");
  const [itemSubprojectId, setItemSubprojectId] = useState("_none");
  const [itemOrder, setItemOrder] = useState("");

const requirementKey = (projectId: string | number, subprojectId?: string | number | null) =>
  `${projectId}:${subprojectId || "none"}`;
const normalizeRequirements = (list: Requirement[]) => {
  const map = new Map<string, Requirement>();
  list.forEach((req) => {
    const key = requirementKey(req.project_id, req.subproject_id || null);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, req);
      return;
    }
    const existingId = existing.id != null ? Number(existing.id) : null;
    const nextId = req.id != null ? Number(req.id) : null;
    if (nextId !== null && (existingId === null || nextId > existingId)) {
      map.set(key, req);
    }
  });
  return Array.from(map.values());
};

  const requirementMap = useMemo(() => {
    const map = new Map<string, Requirement>();
    requirements.forEach((req) => {
      map.set(requirementKey(req.project_id, req.subproject_id || null), req);
    });
    return map;
  }, [requirements]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((project) => map.set(String(project.id), project));
    return map;
  }, [projects]);

  const subprojectMap = useMemo(() => {
    const map = new Map<string, Subproject>();
    subprojects.forEach((subproject) => map.set(String(subproject.id), subproject));
    return map;
  }, [subprojects]);

  const targetCompanyId = useMemo(() => {
    if (isSuperAdmin) return selectedCompanyId;
    return companyId ? String(companyId) : "";
  }, [companyId, isSuperAdmin, selectedCompanyId]);

  const querySuffix = targetCompanyId ? `?company_id=${encodeURIComponent(targetCompanyId)}` : "";

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const companies = await apiFetch<{ id: string; name: string; code?: string | null }[]>("/companies");
        setCompanyOptions(companies || []);
        if (!selectedCompanyId && companies && companies.length) {
          setSelectedCompanyId(String(companies[0].id));
        }
      } catch (err: any) {
        toast.error(err.message || "Kunde inte hämta företag");
      }
    })();
  }, [isSuperAdmin, selectedCompanyId]);

  const loadData = async () => {
    if (isSuperAdmin && !targetCompanyId) {
      setProjects([]);
      setSubprojects([]);
      setRequirements([]);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const [projectsRes, subprojectsRes, requirementsRes, itemsRes] = await Promise.all([
        apiFetch<Project[]>(`/projects${querySuffix}`),
        apiFetch<Subproject[]>(`/subprojects${querySuffix}`),
        apiFetch<{ requirements?: Requirement[] }>(`/admin/self-check/requirements${querySuffix}`),
        apiFetch<{ items?: SelfCheckItem[] }>(`/admin/self-check/items${querySuffix}`),
      ]);

      const projectsArray = ensureArray(projectsRes).map((p: any) => ({
        ...p,
        id: String(p.id),
        is_active: p.is_active === true || p.is_active === 1 || p.is_active === "1",
      }));
      const subprojectsArray = ensureArray(subprojectsRes).map((s: any) => ({
        ...s,
        id: String(s.id),
        project_id: String(s.project_id),
        is_active: s.is_active === true || s.is_active === 1 || s.is_active === "1",
      }));
      setProjects(projectsArray);
      setSubprojects(subprojectsArray);
      setRequirements(normalizeRequirements(ensureArray(requirementsRes?.requirements)));
      setItems(ensureArray(itemsRes?.items));
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta egenkontroll");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetCompanyId]);

  const toggleRequirement = async (projectId: string | number, subprojectId: string | number | null, next: boolean) => {
    const key = requirementKey(projectId, subprojectId);
    const previous = requirements;
    setSavingKey(key);
    setRequirements((prev) =>
      normalizeRequirements([
        ...prev.filter(
          (req) =>
            !(
              String(req.project_id) === String(projectId) &&
              String(req.subproject_id || "") === String(subprojectId || "")
            )
        ),
        { project_id: projectId, subproject_id: subprojectId, required: next ? 1 : 0 },
      ])
    );
    try {
      await apiFetch(`/admin/self-check/requirements${querySuffix}`, {
        method: "POST",
        json: {
          project_id: Number(projectId),
          subproject_id: subprojectId ? Number(subprojectId) : null,
          required: next ? 1 : 0,
        },
      });
      toast.success("Egenkontroll uppdaterad.");
    } catch (err: any) {
      setRequirements(previous);
      toast.error(err.message || "Kunde inte uppdatera egenkontroll");
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddItem = async () => {
    if (!itemLabel.trim()) {
      toast.error("Fyll i kontrollpunkt");
      return;
    }
    try {
      await apiFetch(`/admin/self-check/items${querySuffix}`, {
        method: "POST",
        json: {
          label: itemLabel.trim(),
          project_id: itemProjectId !== "_global" ? Number(itemProjectId) : null,
          subproject_id: itemSubprojectId !== "_none" ? Number(itemSubprojectId) : null,
          sort_order: itemOrder ? Number(itemOrder) : 0,
        },
      });
      toast.success("Kontrollpunkt skapad.");
      setItemLabel("");
      setItemProjectId("_global");
      setItemSubprojectId("_none");
      setItemOrder("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte skapa kontrollpunkt");
    }
  };

  const deleteItem = async (itemId: string | number) => {
    try {
      await apiFetch(`/admin/self-check/items/${itemId}${querySuffix}`, { method: "DELETE" });
      toast.success("Kontrollpunkt borttagen.");
      setItems((prev) => prev.filter((item) => String(item.id) !== String(itemId)));
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort kontrollpunkt");
    }
  };

  const groupedSubprojects = useMemo(() => {
    const grouped = new Map<string, Subproject[]>();
    subprojects.forEach((subproject) => {
      const key = String(subproject.project_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(subproject);
    });
    grouped.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return grouped;
  }, [subprojects]);

  const availableSubprojects = itemProjectId !== "_global"
    ? subprojects.filter((s) => String(s.project_id) === String(itemProjectId))
    : [];
  const visibleProjects = projectTab === "active"
    ? projects.filter((project) => project.is_active)
    : projects.filter((project) => !project.is_active);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Egenkontroll</h1>
          <p className="text-muted-foreground">
            Markera vilka projekt som kräver egenkontroll och bygg egna kontrollpunkter.
          </p>
        </div>
        {isSuperAdmin && (
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Företag</Label>
            <Select value={targetCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="min-w-[220px]">
                <SelectValue placeholder="Välj företag" />
              </SelectTrigger>
              <SelectContent>
                {companyOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <div className="flex flex-col">
                      <span>{c.name}</span>
                      {c.code && <span className="text-xs text-muted-foreground">Kod: {c.code}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <GuideButton
          title="Guide: Egenkontroll"
          steps={[
            "Välj projekt eller underprojekt som ska kräva egenkontroll.",
            "Skapa kontrollpunkter (globala eller kopplade till projekt).",
            "Be användare skicka egenkontroll innan projektet avslutas.",
          ]}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Projekt & underprojekt</CardTitle>
            <p className="text-sm text-muted-foreground">Slå på egenkontroll där den behövs.</p>
          </div>
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={projectTab} onValueChange={(value) => setProjectTab(value as "active" | "completed")}>
            <TabsList>
              <TabsTrigger value="active">Aktiva</TabsTrigger>
              <TabsTrigger value="completed">Avslutade</TabsTrigger>
            </TabsList>
          </Tabs>
          {loading && <p className="text-sm text-muted-foreground">Laddar projekt...</p>}
          {!loading && visibleProjects.length === 0 && (
            <p className="text-sm text-muted-foreground">Inga projekt hittades.</p>
          )}
          {visibleProjects.map((project) => {
            const projectKey = requirementKey(project.id, null);
            const projectRequirement = requirementMap.get(projectKey);
            const projectRequired = projectRequirement ? projectRequirement.required === 1 : false;
            const subprojectList = groupedSubprojects.get(String(project.id)) || [];
            return (
              <div key={project.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{project.name}</h3>
                      {!project.is_active && <Badge variant="secondary">Avslutat</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Projektkrav</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={projectRequired}
                      onCheckedChange={(value) => toggleRequirement(project.id, null, value)}
                      disabled={savingKey === projectKey}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-l pl-4">
                  {subprojectList.length === 0 && (
                    <p className="text-xs text-muted-foreground">Inga underprojekt.</p>
                  )}
                  {subprojectList.map((subproject) => {
                    const subKey = requirementKey(project.id, subproject.id);
                    const subRequirement = requirementMap.get(subKey);
                    const subRequired = subRequirement ? subRequirement.required === 1 : false;
                    return (
                      <div key={subproject.id} className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{subproject.name}</span>
                            {!subproject.is_active && <Badge variant="secondary">Avslutat</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Underprojekt</p>
                        </div>
                        <Switch
                          checked={subRequired}
                          onCheckedChange={(value) => toggleRequirement(project.id, subproject.id, value)}
                          disabled={savingKey === subKey}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kontrollpunkter</CardTitle>
          <p className="text-sm text-muted-foreground">Skapa egna checklistor för arbetsmiljö och riskbedömning.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_120px_auto]">
            <div className="space-y-2">
              <Label>Kontrollpunkt</Label>
              <Input value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} placeholder="T.ex. Riskbedömning utförd" />
            </div>
            <div className="space-y-2">
              <Label>Projekt</Label>
              <Select
                value={itemProjectId}
                onValueChange={(value) => {
                  setItemProjectId(value);
                  setItemSubprojectId("_none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Global" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_global">Global</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Underprojekt</Label>
              <Select
                value={itemSubprojectId}
                onValueChange={setItemSubprojectId}
                disabled={itemProjectId === "_global"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Valfritt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ingen</SelectItem>
                  {availableSubprojects.map((subproject) => (
                    <SelectItem key={subproject.id} value={String(subproject.id)}>
                      {subproject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordning</Label>
              <Input
                type="number"
                value={itemOrder}
                onChange={(e) => setItemOrder(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddItem} className="gap-2">
                <Plus className="h-4 w-4" />
                Lägg till
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga kontrollpunkter skapade ännu.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const project = item.project_id ? projectMap.get(String(item.project_id)) : null;
                const subproject = item.subproject_id ? subprojectMap.get(String(item.subproject_id)) : null;
                const scopeLabel = subproject
                  ? `${project?.name || "Projekt"} / ${subproject.name}`
                  : project
                    ? project.name
                    : "Global";
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{scopeLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.sort_order ? <Badge variant="outline">#{item.sort_order}</Badge> : null}
                      <Button variant="outline" size="sm" onClick={() => deleteItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSelfChecks;
