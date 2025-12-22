import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/api/client";
import { toast } from "sonner";
import { FolderKanban, Plus, Edit, Trash2, RotateCcw, User, Briefcase, Tag } from "lucide-react";

interface Customer {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  code?: string | null;
  notes?: string | null;
  is_active: boolean;
  customer_id: number | null;
  customer_name?: string | null;
}

interface Subproject {
  id: number;
  project_id: number;
  name: string;
  code?: string | null;
  is_active: boolean;
}

const AdminProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showSubprojectDialog, setShowSubprojectDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Project form
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectCustomerId, setProjectCustomerId] = useState<string>("_none");
  const [projectCode, setProjectCode] = useState("");
  const [projectNotes, setProjectNotes] = useState("");

  // Subproject form
  const [editingSubprojectId, setEditingSubprojectId] = useState<string | null>(null);
  const [subprojectName, setSubprojectName] = useState("");
  const [subprojectProjectId, setSubprojectProjectId] = useState("");
  const [subprojectCode, setSubprojectCode] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, subprojectsRes, customersRes] = await Promise.all([
        apiFetch<Project[]>("/projects"),
        apiFetch<Subproject[]>("/subprojects"),
        apiFetch<Customer[]>("/customers"),
      ]);
      if (projectsRes) {
        setProjects(
          projectsRes.map((p) => ({
            ...p,
            is_active: p.is_active === true || p.is_active === 1 || p.is_active === "1",
          }))
        );
      }
      if (subprojectsRes) {
        setSubprojects(
          subprojectsRes.map((s) => ({
            ...s,
            is_active: s.is_active === true || s.is_active === 1 || s.is_active === "1",
          }))
        );
      }
      if (customersRes) setCustomers(customersRes);
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta projektdata");
    }
  };
  
  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return null;
    const customer = customers.find(c => String(c.id) === String(customerId));
    return customer?.name || null;
  };

  const activeProjects = projects.filter(p => p.is_active);
  const inactiveProjects = projects.filter(p => !p.is_active);

  const openProjectDialog = (project?: Project) => {
    if (project) {
      setEditingProjectId(String(project.id));
      setProjectName(project.name);
      setProjectCustomerId(project.customer_id ? String(project.customer_id) : "_none");
      setProjectCode(project.code || "");
      setProjectNotes(project.notes || "");
    } else {
      setEditingProjectId(null);
      setProjectName("");
      setProjectCustomerId("_none");
      setProjectCode("");
      setProjectNotes("");
    }
    setShowProjectDialog(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProjectId) {
          await apiFetch(`/projects/${editingProjectId}`, {
            method: "PUT",
            json: {
              name: projectName.trim(),
              customer_id: projectCustomerId && projectCustomerId !== "_none" ? Number(projectCustomerId) : null,
              code: projectCode.trim() || null,
              notes: projectNotes.trim() || null,
            },
          });
          toast.success("Projekt uppdaterat!");
      } else {
        await apiFetch(`/projects`, {
          method: "POST",
          json: {
            name: projectName.trim(),
            customer_id: projectCustomerId && projectCustomerId !== "_none" ? Number(projectCustomerId) : null,
            code: projectCode.trim() || null,
            notes: projectNotes.trim() || null,
            is_active: 1,
          },
        });
        toast.success("Projekt skapat!");
      }

      setShowProjectDialog(false);
      resetProjectForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetProjectForm = () => {
    setEditingProjectId(null);
    setProjectName("");
    setProjectCustomerId("_none");
    setProjectCode("");
    setProjectNotes("");
  };

  const openSubprojectDialog = (subproject?: Subproject) => {
    if (subproject) {
      setEditingSubprojectId(String(subproject.id));
      setSubprojectName(subproject.name);
      setSubprojectProjectId(String(subproject.project_id));
      setSubprojectCode(subproject.code || "");
    } else {
      setEditingSubprojectId(null);
      setSubprojectName("");
      setSubprojectProjectId("");
      setSubprojectCode("");
    }
    setShowSubprojectDialog(true);
  };

  const handleSubprojectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSubprojectId) {
        await apiFetch(`/subprojects/${editingSubprojectId}`, {
          method: "PUT",
          json: {
            project_id: Number(subprojectProjectId),
            name: subprojectName.trim(),
            code: subprojectCode.trim() || null,
          },
        });
        toast.success("Underprojekt uppdaterat!");
      } else {
        await apiFetch(`/subprojects`, {
          method: "POST",
          json: {
            project_id: Number(subprojectProjectId),
            name: subprojectName.trim(),
            code: subprojectCode.trim() || null,
            is_active: 1,
          },
        });
        toast.success("Underprojekt skapat!");
      }

      setShowSubprojectDialog(false);
      setEditingSubprojectId(null);
      setSubprojectName("");
      setSubprojectProjectId("");
      setSubprojectCode("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleProjectActive = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/projects/${id}`, {
        method: "PUT",
        json: { is_active: active ? 0 : 1 },
      });
      toast.success(active ? "Projekt avslutat" : "Projekt återaktiverat");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte uppdatera projektstatus");
    }
  };

  const deleteProject = async (id: string) => {
    // First check if there are any subprojects
    const projectSubprojects = subprojects.filter(sp => String(sp.project_id) === String(id));
    if (projectSubprojects.length > 0) {
      toast.error("Kan inte ta bort projektet. Ta bort alla underprojekt först.");
      return;
    }

    // Check if there are time entries
    try {
      await apiFetch(`/projects/${id}`, { method: "DELETE" });
      toast.success("Projekt borttaget");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort projektet");
    }
  };

  const deleteSubproject = async (id: string) => {
    try {
      await apiFetch(`/subprojects/${id}`, { method: "DELETE" });
      toast.success("Underprojekt borttaget");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort underprojekt");
    }
  };

  const renderProjectCard = (project: Project, isInactiveTab: boolean) => (
    <Card key={project.id} className="shadow-card">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              {project.name}
            {!project.is_active && <Badge variant="outline">Avslutat</Badge>}
            </CardTitle>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              {(project.customer_id || project.customer_name) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Kund: {getCustomerName(project.customer_id) || project.customer_name}</span>
                </div>
              )}
              {project.code && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  <span>Kod: {project.code}</span>
                </div>
              )}
              {project.notes && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>Notis: {project.notes}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openProjectDialog(project)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Redigera
            </Button>
            {isInactiveTab ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleProjectActive(String(project.id), project.is_active)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Återaktivera
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleProjectActive(String(project.id), project.is_active)}
              >
                Avsluta
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteProject(project.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <h4 className="font-semibold mb-2">Underprojekt:</h4>
        {subprojects.filter(sp => sp.project_id === project.id).length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga underprojekt</p>
        ) : (
          <div className="space-y-2">
            {subprojects
              .filter(sp => sp.project_id === project.id)
              .map(subproject => (
                <div key={subproject.id} className="flex justify-between items-center border rounded p-2">
                  <div>
                    <span className="font-medium">{subproject.name}</span>
                    {subproject.code && (
                      <p className="text-sm text-muted-foreground">Kod: {subproject.code}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openSubprojectDialog(subproject)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteSubproject(subproject.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold font-heading">Projekt & Underprojekt</h2>
          <p className="text-muted-foreground">Hantera projekt och underprojekt</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openProjectDialog()} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nytt projekt
          </Button>
          <Button onClick={() => openSubprojectDialog()} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nytt underprojekt
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Aktiva projekt ({activeProjects.length})</TabsTrigger>
          <TabsTrigger value="completed">Avslutade projekt ({inactiveProjects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {activeProjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Inga aktiva projekt</p>
          ) : (
            activeProjects.map((project) => renderProjectCard(project, false))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          {inactiveProjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Inga avslutade projekt</p>
          ) : (
            inactiveProjects.map((project) => renderProjectCard(project, true))
          )}
        </TabsContent>
      </Tabs>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProjectId ? "Redigera projekt" : "Nytt projekt"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProjectSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Projektnamn *</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="T.ex. Renovering kontor"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectCustomerId">Kund</Label>
              <Select value={projectCustomerId} onValueChange={setProjectCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ingen kund vald</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectCode">Projektnummer/kod</Label>
              <Input
                id="projectCode"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="T.ex. PRJ-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectNotes">Anteckning</Label>
              <Textarea
                id="projectNotes"
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                placeholder="Anteckning om projektet..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowProjectDialog(false)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? editingProjectId
                    ? "Uppdaterar..."
                    : "Skapar..."
                  : editingProjectId
                  ? "Uppdatera projekt"
                  : "Skapa projekt"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subproject Dialog */}
      <Dialog open={showSubprojectDialog} onOpenChange={setShowSubprojectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubprojectId ? "Redigera underprojekt" : "Nytt underprojekt"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubprojectSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subprojectProject">Projekt</Label>
              <select
                id="subprojectProject"
                value={subprojectProjectId}
                onChange={(e) => setSubprojectProjectId(e.target.value)}
                className="w-full border rounded p-2 bg-background"
                required
              >
                <option value="">Välj projekt</option>
                {projects.filter(p => p.is_active).map(project => (
                  <option key={project.id} value={String(project.id)}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subprojectName">Namn</Label>
              <Input
                id="subprojectName"
                value={subprojectName}
                onChange={(e) => setSubprojectName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subprojectCode">Kod (valfri)</Label>
              <Input
                id="subprojectCode"
                value={subprojectCode}
                onChange={(e) => setSubprojectCode(e.target.value)}
                placeholder="T.ex. DEL-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowSubprojectDialog(false)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? editingSubprojectId
                    ? "Uppdaterar..."
                    : "Skapar..."
                  : editingSubprojectId
                  ? "Uppdatera underprojekt"
                  : "Skapa underprojekt"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProjects;
