import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/api/client";
import { toast } from "sonner";
import { ensureArray } from "@/lib/ensureArray";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { PlanningGantt } from "@/components/admin/PlanningGantt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VEHICLE_OPTIONS = [
  "Crafter NFM",
  "Crafter BXX",
  "Ford OMA",
  "Caddy LUW",
  "Caddy LNZ",
];

interface UserProfile {
  id: number | string;
  full_name: string;
}

interface Project {
  id: number | string;
  name: string;
}

interface Subproject {
  id: number | string;
  name: string;
  project_id: number | string;
}

interface ScheduledAssignment {
  id: number | string;
  user_id: number | string;
  project: string;
  subproject: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  first_shift_start_time: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  vehicle: string | null;
  work_address: string | null;
  tentative: boolean | number;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export default function AdminPlanning() {
  const { companyId, user } = useAuth();
  const [assignments, setAssignments] = useState<ScheduledAssignment[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedSubproject, setSelectedSubproject] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [notes, setNotes] = useState("");
  const [firstShiftStartTime, setFirstShiftStartTime] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [isTentative, setIsTentative] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const handleDragCreateAssignment = (userId: string, startDate: Date, endDate: Date) => {
    setSelectedUser(userId);
    setDateRange({ from: startDate, to: endDate });
    setEditingAssignmentId(null);
    setDialogOpen(true);
  };

  const handleEditAssignment = (assignment: ScheduledAssignment) => {
    // Redigering inte fullt stödd än (ingen PUT-endpoint). Förifyll för ev. framtida stöd.
    setEditingAssignmentId(String(assignment.id));
    setSelectedUser(String(assignment.user_id));
    // Försök matcha projekt/subprojekt via namn
    const projectMatch = projects.find((p) => p.name === assignment.project);
    setSelectedProject(projectMatch ? String(projectMatch.id) : "");
    const subMatch = subprojects.find((sp) => sp.name === assignment.subproject);
    setSelectedSubproject(subMatch ? String(subMatch.id) : "");
    const safeStart = assignment.start_date ? parseISO(assignment.start_date) : undefined;
    const safeEnd = assignment.end_date ? parseISO(assignment.end_date) : undefined;
    setDateRange({
      from: safeStart && !isNaN(safeStart.getTime()) ? safeStart : undefined,
      to: safeEnd && !isNaN(safeEnd.getTime()) ? safeEnd : undefined,
    });
    setNotes(assignment.notes || "");
    setFirstShiftStartTime(assignment.first_shift_start_time?.slice(0, 5) || "");
    setContactPerson(assignment.contact_person || "");
    setContactPhone(assignment.contact_phone || "");
    setSelectedVehicle(assignment.vehicle || "");
    setWorkAddress(assignment.work_address || "");
    setIsTentative(!!assignment.tentative);
    setDialogOpen(true);
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      // Scope planer och användare till aktuellt företag
      const plansUrl = companyId ? `/plans?company_id=${companyId}` : `/plans`;
      const usersUrl = companyId ? `/admin/users?company_id=${companyId}` : `/admin/users`;
      const projectsUrl = companyId ? `/projects?company_id=${companyId}` : `/projects`;
      const subprojectsUrl = companyId ? `/subprojects?company_id=${companyId}` : `/subprojects`;

      const assignmentsRes = await apiFetch(plansUrl).catch(() => []);
      const usersRes = await apiFetch(usersUrl).catch(() => []);
      const projectsRes = await apiFetch(projectsUrl).catch(() => []);
      const subprojectsRes = await apiFetch(subprojectsUrl).catch(() => []);

      const normalizedAssignments = ensureArray(assignmentsRes).map((a: any) => ({
        ...a,
        user_id: String(a.user_id),
        project_id: a.project_id ? String(a.project_id) : String(a.project || ""),
        subproject_id: a.subproject_id ? String(a.subproject_id) : a.subproject ? String(a.subproject) : null,
        projects: { name: a.project || a.projects?.name || "" },
        subprojects: a.subproject || a.subprojects ? { name: a.subproject || a.subprojects?.name || "" } : null,
        is_tentative: a.tentative === true || a.tentative === 1 || a.is_tentative,
      }));

      setAssignments(normalizedAssignments);
      setUsers(
        ensureArray(usersRes).map((u: any) => ({
          id: String(u.id),
          full_name: u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Okänd",
        }))
      );

      const projectsArray: any[] = ensureArray(projectsRes);
      const subprojectsArray: any[] = ensureArray(subprojectsRes);

      setProjects(projectsArray.map((p: any) => ({ ...p, id: String(p.id) })));
      setSubprojects(subprojectsArray.map((sp: any) => ({ ...sp, id: String(sp.id), project_id: String(sp.project_id) })));
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Kunde inte hämta data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedUser || !selectedProject || !dateRange.from || !dateRange.to) {
      toast.error("Vänligen fyll i alla obligatoriska fält");
      return;
    }
    try {
      const projectName = projects.find((p) => String(p.id) === String(selectedProject))?.name || selectedProject;
      const subprojectName =
        subprojects.find((sp) => String(sp.id) === String(selectedSubproject))?.name || selectedSubproject || "";

      if (editingAssignmentId) {
        // Update existing assignment
        toast.error("Uppdatering av planering stöds inte ännu");
        return;
      } else {
        // Create new assignment
        await apiFetch(`/plans`, {
          method: "POST",
          json: {
            user_id: selectedUser,
            project: projectName,
            subproject: subprojectName,
            start_date: format(dateRange.from, "yyyy-MM-dd"),
            end_date: format(dateRange.to, "yyyy-MM-dd"),
            notes: notes || null,
            first_shift_start_time: firstShiftStartTime || null,
            contact_person: contactPerson || null,
            contact_phone: contactPhone || null,
            vehicle: selectedVehicle || null,
            work_address: workAddress || null,
            tentative: isTentative,
            created_by: user?.id,
            company_id: companyId,
          },
        });

        toast.success("Planering skapad");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving assignment:", error);
      toast.error(editingAssignmentId ? "Kunde inte uppdatera planering" : "Kunde inte skapa planering");
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    toast.error("Radering av planering stöds inte ännu i backend");
  };

  const resetForm = () => {
    setSelectedUser("");
    setSelectedProject("");
    setSelectedSubproject("");
    setDateRange({ from: undefined, to: undefined });
    setNotes("");
    setFirstShiftStartTime("");
    setContactPerson("");
    setContactPhone("");
    setSelectedVehicle("");
    setWorkAddress("");
    setIsTentative(false);
    setEditingAssignmentId(null);
  };

  const filteredSubprojects = subprojects.filter(
    (sp) => sp.project_id === selectedProject
  );

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div>Laddar planering...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Resursplanering (Admin)</h1>
          <p className="text-muted-foreground">
            Hantera arbetsplanering för användare
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Ny resursplan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAssignmentId ? "Redigera planering" : "Skapa ny planering"}</DialogTitle>
              <DialogDescription>
                {editingAssignmentId ? "Uppdatera befintlig planering" : "Lägg till projekt i kalendern och tilldela användare"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user">Användare *</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger id="user">
                    <SelectValue placeholder="Välj användare" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="project">Projekt *</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Välj projekt" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="tentative"
                    checked={isTentative}
                    onCheckedChange={(checked) => setIsTentative(checked === true)}
                  />
                  <Label htmlFor="tentative" className="flex items-center gap-1 cursor-pointer text-sm">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    Eventuellt jobb
                  </Label>
                </div>
              </div>

              {selectedProject && filteredSubprojects.length > 0 && (
                <div>
                  <Label htmlFor="subproject">Delprojekt (valfritt)</Label>
                  <Select value={selectedSubproject} onValueChange={setSelectedSubproject}>
                    <SelectTrigger id="subproject">
                      <SelectValue placeholder="Välj delprojekt" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubprojects.map((subproject) => (
                        <SelectItem key={subproject.id} value={subproject.id}>
                          {subproject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstShiftTime">Första skift startar</Label>
                  <Input
                    id="firstShiftTime"
                    type="time"
                    value={firstShiftStartTime}
                    onChange={(e) => setFirstShiftStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="vehicle">Fordon</Label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                    <SelectTrigger id="vehicle">
                      <SelectValue placeholder="Välj fordon" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_OPTIONS.map((vehicle) => (
                        <SelectItem key={vehicle} value={vehicle}>
                          {vehicle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPerson">Kontaktperson</Label>
                  <Input
                    id="contactPerson"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Namn på kontaktperson"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Telefon kontaktperson</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="070-123 45 67"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="workAddress">Arbetsplatsens adress</Label>
                <Input
                  id="workAddress"
                  value={workAddress}
                  onChange={(e) => setWorkAddress(e.target.value)}
                  placeholder="Storgatan 1, 123 45 Stockholm"
                />
              </div>

              <div>
                <Label>Period *</Label>
                <div className="flex justify-center border rounded-md p-4">
                  <Calendar
                    mode="range"
                    selected={dateRange as any}
                    onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                    locale={sv}
                    numberOfMonths={2}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Anteckningar</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Frivilliga anteckningar om planeringen"
                />
              </div>

              <Button onClick={handleCreateAssignment} className="w-full">
                {editingAssignmentId ? "Uppdatera planering" : "Skapa planering"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="gantt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gantt">Schema</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt">
          <Card>
            <CardHeader>
              <CardTitle>Arbetsschema</CardTitle>
              <CardDescription>
                Överblick av planerade arbetsuppdrag - {assignments.length} planeringar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanningGantt
                assignments={assignments}
                users={users}
                onDeleteAssignment={handleDeleteAssignment}
                onCreateAssignment={handleDragCreateAssignment}
                onEditAssignment={handleEditAssignment}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Alla planeringar</CardTitle>
              <CardDescription>
                {assignments.length} planerade arbetsuppdrag
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-muted-foreground">Inga planeringar än</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const userName =
                      users.find((u) => String(u.id) === String(assignment.user_id))?.full_name ||
                      `${assignment.first_name || ""} ${assignment.last_name || ""}`.trim() ||
                      assignment.email ||
                      "Okänd";
                    return (
                    <Card key={assignment.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div>
                              <span className="font-semibold">Användare: </span>
                              {userName}
                            </div>
                            <div>
                              <span className="font-semibold">Projekt: </span>
                              {assignment.project}
                              {assignment.subproject && ` - ${assignment.subproject}`}
                            </div>
                            <div>
                              <span className="font-semibold">Period: </span>
                              {format(parseISO(assignment.start_date), "d MMM", { locale: sv })} -{" "}
                              {format(parseISO(assignment.end_date), "d MMM yyyy", { locale: sv })}
                            </div>
                            {assignment.notes && (
                              <div>
                                <span className="font-semibold">Anteckningar: </span>
                                {assignment.notes}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
