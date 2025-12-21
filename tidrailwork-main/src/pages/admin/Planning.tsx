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
import { login, getMe, logout } from "@/api/auth";
import { toast } from "sonner";
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
  id: string;
  full_name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Subproject {
  id: string;
  name: string;
  project_id: string;
}

interface ScheduledAssignment {
  id: string;
  user_id: string;
  project_id: string;
  subproject_id: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  first_shift_start_time: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  vehicle: string | null;
  work_address: string | null;
  is_tentative: boolean;
  profiles: {
    full_name: string;
  };
  projects: {
    name: string;
    location?: string | null;
    customer_name?: string | null;
  };
  subprojects: {
    name: string;
  } | null;
}

export default function AdminPlanning() {
  const { companyId } = useAuth();
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
    setEditingAssignmentId(assignment.id);
    setSelectedUser(assignment.user_id);
    setSelectedProject(assignment.project_id);
    setSelectedSubproject(assignment.subproject_id || "");
    setDateRange({
      from: parseISO(assignment.start_date),
      to: parseISO(assignment.end_date),
    });
    setNotes(assignment.notes || "");
    setFirstShiftStartTime(assignment.first_shift_start_time?.slice(0, 5) || "");
    setContactPerson(assignment.contact_person || "");
    setContactPhone(assignment.contact_phone || "");
    setSelectedVehicle(assignment.vehicle || "");
    setWorkAddress(assignment.work_address || "");
    setIsTentative(assignment.is_tentative);
    setDialogOpen(true);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assignmentsRes, usersRes, projectsRes, subprojectsRes] = await Promise.all([
        apiFetch(`/scheduled-assignments?order=start_date`),
        apiFetch(`/profiles?order=full_name`),
        apiFetch(`/projects?active=true&order=name`),
        apiFetch(`/subprojects?active=true&order=name`),
      ]);

      setAssignments(assignmentsRes || []);
      setUsers(usersRes || []);
      setProjects(projectsRes || []);
      setSubprojects(subprojectsRes || []);
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
      const userData = await getMe();

      if (editingAssignmentId) {
        // Update existing assignment
        await apiFetch(`/scheduled-assignments/${editingAssignmentId}`, {
          method: "PUT",
          json: {
            user_id: selectedUser,
            project_id: selectedProject,
            subproject_id: selectedSubproject || null,
            start_date: format(dateRange.from, "yyyy-MM-dd"),
            end_date: format(dateRange.to, "yyyy-MM-dd"),
            notes: notes || null,
            first_shift_start_time: firstShiftStartTime || null,
            contact_person: contactPerson || null,
            contact_phone: contactPhone || null,
            vehicle: selectedVehicle || null,
            work_address: workAddress || null,
            is_tentative: isTentative,
          },
        });

        toast.success("Planering uppdaterad");
      } else {
        // Create new assignment
        await apiFetch(`/scheduled-assignments`, {
          method: "POST",
          json: {
            user_id: selectedUser,
            project_id: selectedProject,
            subproject_id: selectedSubproject || null,
            start_date: format(dateRange.from, "yyyy-MM-dd"),
            end_date: format(dateRange.to, "yyyy-MM-dd"),
            notes: notes || null,
            first_shift_start_time: firstShiftStartTime || null,
            contact_person: contactPerson || null,
            contact_phone: contactPhone || null,
            vehicle: selectedVehicle || null,
            work_address: workAddress || null,
            is_tentative: isTentative,
            created_by: userData.user?.id,
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
    try {
      await apiFetch(`/scheduled-assignments/${id}`, { method: "DELETE" });
      toast.success("Planering borttagen");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      toast.error("Kunde inte ta bort planering");
    }
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
          <h1 className="text-3xl font-bold mb-2">Planering (Admin)</h1>
          <p className="text-muted-foreground">
            Hantera arbetsplanering för användare
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Ny planering
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
                  {assignments.map((assignment) => (
                    <Card key={assignment.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div>
                              <span className="font-semibold">Användare: </span>
                              {assignment.profiles.full_name}
                            </div>
                            <div>
                              <span className="font-semibold">Projekt: </span>
                              {assignment.projects.name}
                              {assignment.subprojects && ` - ${assignment.subprojects.name}`}
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
