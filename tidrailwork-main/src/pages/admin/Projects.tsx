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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FolderKanban, Plus, Edit, Trash2, RotateCcw, MapPin, User, Briefcase, Tag } from "lucide-react";

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  active: boolean;
  customer_id: string | null;
  customer_name: string | null;
  work_task: string | null;
  location: string | null;
  internal_marking: string | null;
}

interface Subproject {
  id: string;
  project_id: string;
  name: string;
  description: string;
  active: boolean;
}

const AdminProjects = () => {
  const { companyId } = useAuth();
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
  const [projectDescription, setProjectDescription] = useState("");
  const [projectCustomerId, setProjectCustomerId] = useState<string>("");
  const [projectWorkTask, setProjectWorkTask] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectInternalMarking, setProjectInternalMarking] = useState("");

  // Subproject form
  const [editingSubprojectId, setEditingSubprojectId] = useState<string | null>(null);
  const [subprojectName, setSubprojectName] = useState("");
  const [subprojectDescription, setSubprojectDescription] = useState("");
  const [subprojectProjectId, setSubprojectProjectId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [projectsRes, subprojectsRes, customersRes] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("subprojects").select("*").order("name"),
      supabase.from("customers").select("*").order("name"),
    ]);

    if (projectsRes.data) setProjects(projectsRes.data as Project[]);
    if (subprojectsRes.data) setSubprojects(subprojectsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
  };
  
  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return null;
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || null;
  };

  const activeProjects = projects.filter(p => p.active);
  const inactiveProjects = projects.filter(p => !p.active);

  const openProjectDialog = (project?: Project) => {
    if (project) {
      setEditingProjectId(project.id);
      setProjectName(project.name);
      setProjectDescription(project.description || "");
      setProjectCustomerId(project.customer_id || "");
      setProjectWorkTask(project.work_task || "");
      setProjectLocation(project.location || "");
      setProjectInternalMarking(project.internal_marking || "");
    } else {
      setEditingProjectId(null);
      setProjectName("");
      setProjectDescription("");
      setProjectCustomerId("");
      setProjectWorkTask("");
      setProjectLocation("");
      setProjectInternalMarking("");
    }
    setShowProjectDialog(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProjectId) {
        // Update existing project
        const { error } = await supabase
          .from("projects")
          .update({
            name: projectName.trim(),
            description: projectDescription.trim(),
            customer_id: projectCustomerId || null,
            work_task: projectWorkTask.trim() || null,
            location: projectLocation.trim() || null,
            internal_marking: projectInternalMarking.trim() || null,
          })
          .eq("id", editingProjectId);

        if (error) throw error;
        toast.success("Projekt uppdaterat!");
      } else {
        // Create new project
        const { error } = await supabase.from("projects").insert({
          name: projectName.trim(),
          description: projectDescription.trim(),
          customer_id: projectCustomerId || null,
          work_task: projectWorkTask.trim() || null,
          location: projectLocation.trim() || null,
          internal_marking: projectInternalMarking.trim() || null,
          active: true,
          company_id: companyId,
        } as any);

        if (error) throw error;
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
    setProjectDescription("");
    setProjectCustomerId("");
    setProjectWorkTask("");
    setProjectLocation("");
    setProjectInternalMarking("");
  };

  const openSubprojectDialog = (subproject?: Subproject) => {
    if (subproject) {
      setEditingSubprojectId(subproject.id);
      setSubprojectName(subproject.name);
      setSubprojectDescription(subproject.description || "");
      setSubprojectProjectId(subproject.project_id);
    } else {
      setEditingSubprojectId(null);
      setSubprojectName("");
      setSubprojectDescription("");
      setSubprojectProjectId("");
    }
    setShowSubprojectDialog(true);
  };

  const handleSubprojectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSubprojectId) {
        // Update existing subproject
        const { error } = await supabase
          .from("subprojects")
          .update({
            project_id: subprojectProjectId,
            name: subprojectName.trim(),
            description: subprojectDescription.trim(),
          })
          .eq("id", editingSubprojectId);

        if (error) throw error;
        toast.success("Underprojekt uppdaterat!");
      } else {
        // Create new subproject
        const { error } = await supabase.from("subprojects").insert({
          project_id: subprojectProjectId,
          name: subprojectName.trim(),
          description: subprojectDescription.trim(),
          active: true,
          company_id: companyId,
        } as any);

        if (error) throw error;
        toast.success("Underprojekt skapat!");
      }

      setShowSubprojectDialog(false);
      setEditingSubprojectId(null);
      setSubprojectName("");
      setSubprojectDescription("");
      setSubprojectProjectId("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleProjectActive = async (id: string, active: boolean) => {
    // If deactivating, check that all time entries are attested
    if (active) {
      const { data: unattested, error: checkError } = await supabase
        .from("time_entries")
        .select("id")
        .eq("project_id", id)
        .is("attested_by", null);

      if (checkError) {
        toast.error("Kunde inte kontrollera tidsrapporter");
        return;
      }

      if (unattested && unattested.length > 0) {
        toast.error(`Kan inte avsluta projektet. Det finns ${unattested.length} oattesterade tidsrapporter som måste attesteras först.`);
        return;
      }
    }

    const { error } = await supabase
      .from("projects")
      .update({ active: !active })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(active ? "Projekt avslutat" : "Projekt återaktiverat");
      fetchData();
    }
  };

  const deleteProject = async (id: string) => {
    // First check if there are any subprojects
    const projectSubprojects = subprojects.filter(sp => sp.project_id === id);
    if (projectSubprojects.length > 0) {
      toast.error("Kan inte ta bort projektet. Ta bort alla underprojekt först.");
      return;
    }

    // Check if there are time entries
    const { data: timeEntries, error: checkError } = await supabase
      .from("time_entries")
      .select("id")
      .eq("project_id", id)
      .limit(1);

    if (checkError) {
      toast.error("Kunde inte kontrollera tidsrapporter");
      return;
    }

    if (timeEntries && timeEntries.length > 0) {
      toast.error("Kan inte ta bort projektet eftersom det finns tidsrapporter kopplade till det. Avsluta projektet istället.");
      return;
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Projekt borttaget");
      fetchData();
    }
  };

  const deleteSubproject = async (id: string) => {
    // Check if there are time entries linked to this subproject
    const { data: timeEntries, error: checkError } = await supabase
      .from("time_entries")
      .select("id")
      .eq("subproject_id", id)
      .limit(1);

    if (checkError) {
      toast.error("Kunde inte kontrollera tidsrapporter");
      return;
    }

    if (timeEntries && timeEntries.length > 0) {
      toast.error("Kan inte ta bort underprojektet eftersom det finns tidsrapporter kopplade till det.");
      return;
    }

    const { error } = await supabase
      .from("subprojects")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Underprojekt borttaget");
      fetchData();
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
              {!project.active && <Badge variant="outline">Avslutat</Badge>}
            </CardTitle>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              {(project.customer_id || project.customer_name) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Kund: {getCustomerName(project.customer_id) || project.customer_name}</span>
                </div>
              )}
              {project.work_task && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>Uppgift: {project.work_task}</span>
                </div>
              )}
              {project.location && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Plats: {project.location}</span>
                </div>
              )}
              {project.internal_marking && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  <span>Märkning: {project.internal_marking}</span>
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
                onClick={() => toggleProjectActive(project.id, project.active)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Återaktivera
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleProjectActive(project.id, project.active)}
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
                    {subproject.description && (
                      <p className="text-sm text-muted-foreground">{subproject.description}</p>
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
              <Select value={projectCustomerId || "_none"} onValueChange={(val) => setProjectCustomerId(val === "_none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ingen kund vald</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectWorkTask">Arbetsuppgift</Label>
              <Input
                id="projectWorkTask"
                value={projectWorkTask}
                onChange={(e) => setProjectWorkTask(e.target.value)}
                placeholder="T.ex. Elinstallation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectLocation">Plats</Label>
              <Input
                id="projectLocation"
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
                placeholder="T.ex. Stockholm Central"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectInternalMarking">Intern märkning (visas på export/attestering)</Label>
              <Input
                id="projectInternalMarking"
                value={projectInternalMarking}
                onChange={(e) => setProjectInternalMarking(e.target.value)}
                placeholder="T.ex. PRJ-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectDescription">Beskrivning</Label>
              <Textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Ytterligare information om projektet..."
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
                {projects.filter(p => p.active).map(project => (
                  <option key={project.id} value={project.id}>
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
              <Label htmlFor="subprojectDescription">Beskrivning</Label>
              <Textarea
                id="subprojectDescription"
                value={subprojectDescription}
                onChange={(e) => setSubprojectDescription(e.target.value)}
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