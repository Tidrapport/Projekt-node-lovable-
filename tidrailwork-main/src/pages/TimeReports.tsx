import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/api/client";
import { addMaterialToTimeEntry, createTimeEntry, deleteTimeEntry, listTimeEntries, updateTimeEntry, TimeEntry } from "@/api/timeEntries";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Plus, Trash2, X, Pencil, CheckCircle, CalendarDays, List, Copy } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { TimeReportsCalendarView } from "@/components/TimeReportsCalendarView";

interface Project {
  id: string;
  name: string;
}

interface Subproject {
  id: string;
  name: string;
}

interface JobRole {
  id: string;
  name: string;
}

interface MaterialType {
  id: string;
  name: string;
  unit: string;
}

interface MaterialEntry {
  materialTypeId: string;
  quantity: number;
}

const TimeReports = () => {
  const { user, companyId, isAdmin } = useAuth();
  const { effectiveUserId, isImpersonating, impersonatedUserName } = useEffectiveUser();
  const { setImpersonatedUser } = useImpersonation();
  
  // Fetch users for admin selector
  const { data: companyUsers = [] } = useQuery({
    queryKey: ["company-users-for-timereports", companyId],
    queryFn: async () => {
      const data = await apiFetch(`/admin/users?company_id=${companyId}`);
      return data;
    },
    enabled: !!companyId && isAdmin,
  });
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Form state
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [projectId, setProjectId] = useState("");
  const [subprojectId, setSubprojectId] = useState("");
  const [jobRoleId, setJobRoleId] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [perDiemType, setPerDiemType] = useState("none");
  const [travelTimeHours, setTravelTimeHours] = useState("0");
  const [saveTravelCompensation, setSaveTravelCompensation] = useState(false);
  const [overtimeWeekdayHours, setOvertimeWeekdayHours] = useState("0");
  const [overtimeWeekendHours, setOvertimeWeekendHours] = useState("0");
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [aoNumber, setAoNumber] = useState("");
  const [deviationTitle, setDeviationTitle] = useState("");
  const [deviationDescription, setDeviationDescription] = useState("");
  const [deviationStatus, setDeviationStatus] = useState("none");

  useEffect(() => {
    fetchData();
  }, [effectiveUserId]);

  useEffect(() => {
    if (projectId) {
      fetchSubprojects(projectId);
    }
  }, [projectId]);

  const fetchData = async () => {
    if (!effectiveUserId) return;

    try {
      const entriesData = await listTimeEntries({ user_id: effectiveUserId, includeMaterials: true });
      setEntries(entriesData);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta tidrapporter");
    }

    try {
      const projectsData = await apiFetch(`/projects?active=true`);
      if (projectsData) setProjects(projectsData.map((p: any) => ({ ...p, id: String(p.id) })));
    } catch (error) {
      console.error("Error fetching projects", error);
    }

    try {
      const jobRolesData = await apiFetch(`/job-roles?active=true`);
      if (jobRolesData) setJobRoles(jobRolesData.map((j: any) => ({ ...j, id: String(j.id) })));
    } catch (error) {
      console.error("Error fetching job roles", error);
    }

    try {
      const materialTypesData = await apiFetch(`/material-types?active=true`);
      if (materialTypesData) setMaterialTypes(materialTypesData);
    } catch (error) {
      console.error("Error fetching material types", error);
    }
  };

  const fetchSubprojects = async (projectId: string) => {
    const data = await apiFetch(`/subprojects?project_id=${projectId}&active=true`);
    if (data) setSubprojects(data.map((sp: any) => ({ ...sp, id: String(sp.id), project_id: String(sp.project_id) })));
  };

  const calculateHours = (start: string, end: string, breakMins: number): number => {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);

    const startDate = new Date();
    startDate.setHours(startHour, startMin, 0, 0);
    const endDate = new Date();
    endDate.setHours(endHour, endMin, 0, 0);

    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const totalMinutesRaw = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    const effectiveBreak = Math.max(0, Math.min(breakMins, totalMinutesRaw));
    const workMinutes = totalMinutesRaw - effectiveBreak;

    return workMinutes > 0 ? workMinutes / 60 : 0;
  };

  const determineShiftType = (date: string, startTime: string, endTime: string): string => {
    const workDate = new Date(date);
    const dayOfWeek = workDate.getDay(); // 0 = Sunday, 1 = Monday, 5 = Friday, 6 = Saturday
    
    const [startHour] = startTime.split(':').map(Number);
    
    // Helg: 18:00 fredag - 07:00 måndag
    const isFridayEvening = dayOfWeek === 5 && startHour >= 18;
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isMondayMorning = dayOfWeek === 1 && startHour < 7;
    
    if (isFridayEvening || isSaturday || isSunday || isMondayMorning) {
      return "weekend";
    }
    
    // Check weekday time ranges (Monday-Thursday)
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 4;
    
    if (isWeekday) {
      // Natt: 21:00-06:00 måndag-torsdag
      if (startHour >= 21 || startHour < 6) {
        return "night";
      }
      
      // Kväll: 18:00-21:00 måndag-torsdag
      if (startHour >= 18 && startHour < 21) {
        return "evening";
      }
    }
    
    // Dag: 07:00-18:00 måndag-fredag (default for Friday before 18:00)
    return "day";
  };

  const addMaterial = () => {
    if (!selectedMaterial || !materialQuantity) {
      toast.error("Välj material och ange kvantitet");
      return;
    }

    const quantity = parseFloat(materialQuantity);
    if (quantity <= 0) {
      toast.error("Kvantitet måste vara större än 0");
      return;
    }

    // Check if material already added
    if (materials.some(m => m.materialTypeId === selectedMaterial)) {
      toast.error("Materialet är redan tillagt");
      return;
    }

    setMaterials([...materials, { materialTypeId: selectedMaterial, quantity }]);
    setSelectedMaterial("");
    setMaterialQuantity("");
  };

  const removeMaterial = (materialTypeId: string) => {
    setMaterials(materials.filter(m => m.materialTypeId !== materialTypeId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Du måste vara inloggad för att spara tidrapporter");
      return;
    }
    if (!companyId) {
      toast.error("Saknar företagskoppling – ladda om sidan och försök igen");
      return;
    }
    if (!effectiveUserId) return;

    setLoading(true);
    try {
      const totalHours = calculateHours(startTime, endTime, parseInt(breakMinutes));
      const calculatedShiftType = determineShiftType(date, startTime, endTime);

      // Use effectiveUserId so admin can create entries for selected user
      const timeEntryData = await createTimeEntry({
        user_id: effectiveUserId,
        date,
        hours: totalHours,
        break_minutes: parseInt(breakMinutes),
        project_id: projectId,
        subproject_id: subprojectId || undefined,
        job_role_id: jobRoleId || undefined,
        description: workDescription,
        start_time: startTime,
        end_time: endTime,
        status: "submitted",
        allowance_type: perDiemType,
        allowance_amount: perDiemType === "half" ? 145 : perDiemType === "full" ? 290 : 0,
        travel_time_hours: parseFloat(travelTimeHours),
        save_travel_compensation: saveTravelCompensation,
        overtime_weekday_hours: parseFloat(overtimeWeekdayHours),
        overtime_weekend_hours: parseFloat(overtimeWeekendHours),
        ao_number: aoNumber || null,
        deviation_title: deviationTitle || null,
        deviation_description: deviationDescription || null,
        deviation_status: deviationStatus === "none" ? null : deviationStatus,
      });

      // Insert material reports if any
      if (materials.length > 0 && timeEntryData) {
        const materialReports = materials.map(material => ({
          time_entry_id: timeEntryData.id,
          material_type_id: material.materialTypeId,
          quantity: material.quantity,
          company_id: companyId,
        }));

        // Insert material reports via backend
        for (const mr of materialReports) {
          await addMaterialToTimeEntry(timeEntryData.id, {
            material_type_id: mr.material_type_id,
            quantity: mr.quantity,
          });
        }
      }

      toast.success("Tidrapport tillagd!");
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTimeEntry(id);
      toast.success("Tidrapport borttagen");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort tidrapport");
    }
  };

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setStartTime(entry.start_time);
    setEndTime(entry.end_time);
    setBreakMinutes(entry.break_minutes.toString());
    setProjectId(entry.project_id);
    setSubprojectId(entry.subproject_id || "");
    setJobRoleId(entry.job_role_id);
    setWorkDescription(entry.work_description || "");
    setPerDiemType(entry.per_diem_type || "none");
    setTravelTimeHours(entry.travel_time_hours?.toString() || "0");
    setSaveTravelCompensation(entry.save_travel_compensation || false);
    setOvertimeWeekdayHours(entry.overtime_weekday_hours?.toString() || "0");
    setOvertimeWeekendHours(entry.overtime_weekend_hours?.toString() || "0");
    setAoNumber(entry.ao_number || "");
    setDeviationTitle(entry.deviation_title || "");
    setDeviationDescription(entry.deviation_description || "");
    setDeviationStatus(entry.deviation_status || "none");
    setShowDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setLoading(true);
    try {
      const totalHours = calculateHours(startTime, endTime, parseInt(breakMinutes));
      const calculatedShiftType = determineShiftType(date, startTime, endTime);

      if (totalHours <= 0) {
        toast.error("Ogiltiga tider - kontrollera att start- och sluttid är korrekta");
        setLoading(false);
        return;
      }

      await updateTimeEntry(editingEntry.id, {
        date,
        hours: totalHours,
        break_minutes: parseInt(breakMinutes),
        project_id: projectId,
        subproject_id: subprojectId || undefined,
        job_role_id: jobRoleId || undefined,
        description: workDescription,
        status: "submitted",
        start_time: startTime,
        end_time: endTime,
        allowance_type: perDiemType,
        allowance_amount: perDiemType === "half" ? 145 : perDiemType === "full" ? 290 : 0,
        travel_time_hours: parseFloat(travelTimeHours),
        save_travel_compensation: saveTravelCompensation,
        overtime_weekday_hours: parseFloat(overtimeWeekdayHours),
        overtime_weekend_hours: parseFloat(overtimeWeekendHours),
        ao_number: aoNumber || null,
        deviation_title: deviationTitle || null,
        deviation_description: deviationDescription || null,
        deviation_status: deviationStatus === "none" ? null : deviationStatus,
      });

      toast.success("Tidrapport uppdaterad!");
      setShowDialog(false);
      setEditingEntry(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("");
    setEndTime("");
    setBreakMinutes("0");
    setProjectId("");
    setSubprojectId("");
    setJobRoleId("");
    setWorkDescription("");
    setPerDiemType("none");
    setTravelTimeHours("0");
    setSaveTravelCompensation(false);
    setOvertimeWeekdayHours("0");
    setOvertimeWeekendHours("0");
    setAoNumber("");
    setDeviationTitle("");
    setDeviationDescription("");
    setDeviationStatus("none");
    setMaterials([]);
    setSelectedMaterial("");
    setMaterialQuantity("");
    setEditingEntry(null);
  };

  const copyFromLastEntry = () => {
    if (entries.length === 0) {
      toast.error("Inga tidigare tidrapporter att kopiera från");
      return;
    }
    const lastEntry = entries[0]; // entries are sorted by date desc
    setStartTime(lastEntry.start_time);
    setEndTime(lastEntry.end_time);
    setBreakMinutes(lastEntry.break_minutes.toString());
    setProjectId(lastEntry.project_id);
    setSubprojectId(lastEntry.subproject_id || "");
    setJobRoleId(lastEntry.job_role_id);
    setPerDiemType(lastEntry.per_diem_type || "none");
    setTravelTimeHours(lastEntry.travel_time_hours?.toString() || "0");
    setSaveTravelCompensation(lastEntry.save_travel_compensation || false);
    setOvertimeWeekdayHours(lastEntry.overtime_weekday_hours?.toString() || "0");
    setOvertimeWeekendHours(lastEntry.overtime_weekend_hours?.toString() || "0");
    setAoNumber(lastEntry.ao_number || "");
    setDeviationTitle(lastEntry.deviation_title || "");
    setDeviationDescription(lastEntry.deviation_description || "");
    setDeviationStatus(lastEntry.deviation_status || "none");
    toast.success("Kopierade från senaste tidrapporten");
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold font-heading">
            Tidrapporter {isImpersonating && <span className="text-lg font-normal text-muted-foreground">- {impersonatedUserName}</span>}
          </h2>
          <p className="text-muted-foreground">
            {isImpersonating ? `Visar ${impersonatedUserName}s tidrapporter` : "Registrera och hantera dina arbetstimmar"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Admin user selector */}
          {isAdmin && companyUsers.length > 0 && (
            <Select 
              value={effectiveUserId || "none"} 
              onValueChange={(value) => {
                if (value === "none" || value === user?.id) {
                  setImpersonatedUser(null);
                } else {
                  const selectedUser = companyUsers.find((u) => u.id === value);
                  if (selectedUser) {
                    setImpersonatedUser({ id: selectedUser.id, full_name: selectedUser.full_name });
                  }
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Välj användare..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={user?.id || "none"}>-- Min vy --</SelectItem>
                {companyUsers.filter(u => u.id !== user?.id).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="rounded-none"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Kalender
            </Button>
          </div>
          <Button onClick={() => setShowDialog(true)} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Ny tidrapport
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <TimeReportsCalendarView entries={entries} />
      ) : (

      <div className="space-y-4">
        {entries.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Inga tidrapporter ännu</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="pt-6">
                 <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg">
                        {format(new Date(entry.date), "EEEE d MMMM yyyy", { locale: sv })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        v. {format(new Date(entry.date), "w", { locale: sv })}
                      </Badge>
                      {entry.attested_by && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Attesterad
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {entry.start_time} - {entry.end_time} ({entry.total_hours.toFixed(2)}h)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Projekt:</span>{" "}
                        <span className="font-medium">{entry.project?.name}</span>
                      </div>
                      {entry.subproject && (
                        <div>
                          <span className="text-muted-foreground">Underprojekt:</span>{" "}
                          <span className="font-medium">{entry.subproject.name}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Roll:</span>{" "}
                        <span className="font-medium">{entry.job_role?.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Skift:</span>{" "}
                        <span className="font-medium">{entry.shift_type}</span>
                      </div>
                    </div>
                    {entry.work_description && (
                      <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                        {entry.work_description}
                      </p>
                    )}
                    {entry.material_reports && entry.material_reports.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                        <span className="text-sm text-muted-foreground mr-1">Tillägg:</span>
                        {entry.material_reports.map((material) => (
                          <Badge key={material.id} variant="secondary" className="text-xs">
                            {material.material_type.name}: {material.quantity} {material.material_type.unit}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {!entry.attested_by && !isImpersonating && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(entry)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(entry.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{editingEntry ? "Redigera tidrapport" : "Ny tidrapport"}</DialogTitle>
              {!editingEntry && entries.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyFromLastEntry}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Kopiera föregående
                </Button>
              )}
            </div>
          </DialogHeader>
          <form onSubmit={editingEntry ? handleUpdate : handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="break">Rast</Label>
                <Select value={breakMinutes} onValueChange={setBreakMinutes}>
                  <SelectTrigger id="break">
                    <SelectValue placeholder="Välj rast" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Ingen rast</SelectItem>
                    <SelectItem value="15">15 minuter</SelectItem>
                    <SelectItem value="30">30 minuter</SelectItem>
                    <SelectItem value="45">45 minuter</SelectItem>
                    <SelectItem value="60">60 minuter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Starttid</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Sluttid</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">Projekt</Label>
                <Select value={projectId || undefined} onValueChange={setProjectId} required>
                  <SelectTrigger id="project" className="text-foreground">
                    <SelectValue placeholder="Välj projekt" className="text-foreground" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="text-foreground">
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subproject">Underprojekt (valfritt)</Label>
                <Select value={subprojectId || undefined} onValueChange={setSubprojectId}>
                  <SelectTrigger id="subproject" className="text-foreground">
                    <SelectValue placeholder="Välj underprojekt" className="text-foreground" />
                  </SelectTrigger>
                  <SelectContent>
                    {subprojects.map((subproject) => (
                      <SelectItem key={subproject.id} value={subproject.id}>
                        <span className="text-foreground">{subproject.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobRole">Yrkesroll</Label>
                <Select value={jobRoleId || undefined} onValueChange={setJobRoleId} required>
                  <SelectTrigger id="jobRole" className="text-foreground">
                    <SelectValue placeholder="Välj roll" className="text-foreground" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id} className="text-foreground">
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aoNumber">AO-nummer (frivilligt)</Label>
                <Input
                  id="aoNumber"
                  value={aoNumber}
                  onChange={(e) => setAoNumber(e.target.value)}
                  placeholder="Ange AO-nummer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Arbetsbeskrivning</Label>
              <Textarea
                id="description"
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Beskriv vad som utfördes..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="perDiem">Traktamente</Label>
                <Select value={perDiemType || undefined} onValueChange={setPerDiemType}>
                  <SelectTrigger id="perDiem">
                    <SelectValue placeholder="Välj traktamente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    <SelectItem value="half">Halv traktamente</SelectItem>
                    <SelectItem value="full">Hel traktamente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="travelTime">Restidsersättning (timmar)</Label>
                <Input
                  id="travelTime"
                  type="number"
                  value={travelTimeHours}
                  onChange={(e) => setTravelTimeHours(e.target.value)}
                  min="0"
                  step="0.5"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overtimeWeekday">Övertid vardag (timmar)</Label>
                <Input
                  id="overtimeWeekday"
                  type="number"
                  value={overtimeWeekdayHours}
                  onChange={(e) => setOvertimeWeekdayHours(e.target.value)}
                  min="0"
                  step="0.5"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">+64% på timlönen</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeWeekend">Övertid helg (timmar)</Label>
                <Input
                  id="overtimeWeekend"
                  type="number"
                  value={overtimeWeekendHours}
                  onChange={(e) => setOvertimeWeekendHours(e.target.value)}
                  min="0"
                  step="0.5"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">+124% på timlönen</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <Checkbox
                id="saveTravelCompensation"
                checked={saveTravelCompensation}
                onCheckedChange={(checked) => setSaveTravelCompensation(checked === true)}
                disabled={parseFloat(travelTimeHours) <= 0}
              />
              <Label htmlFor="saveTravelCompensation" className={`flex-1 cursor-pointer font-medium ${parseFloat(travelTimeHours) <= 0 ? "text-muted-foreground" : ""}`}>
                Spara restidsersättning
              </Label>
              {parseFloat(travelTimeHours) > 0 && (
                <span className="text-sm font-bold text-primary">
                  {(parseFloat(travelTimeHours) * 170).toLocaleString("sv-SE")} kr {saveTravelCompensation ? "sparas" : ""}
                </span>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label>Tillägg (valfritt)</Label>
              <div className="flex gap-2">
                <Select value={selectedMaterial || undefined} onValueChange={setSelectedMaterial}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Välj tillägg" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {materialTypes.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} ({material.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Antal"
                  value={materialQuantity}
                  onChange={(e) => setMaterialQuantity(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-24"
                />
                <Button type="button" onClick={addMaterial} variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {materials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {materials.map((material) => {
                    const materialType = materialTypes.find(mt => mt.id === material.materialTypeId);
                    return (
                      <Badge key={material.materialTypeId} variant="secondary" className="gap-1">
                        {materialType?.name}: {material.quantity} {materialType?.unit}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => removeMaterial(material.materialTypeId)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Avbryt
              </Button>
              <Button type="submit" className="bg-gradient-primary" disabled={loading}>
                {loading ? "Sparar..." : (editingEntry ? "Uppdatera tidrapport" : "Spara tidrapport")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeReports;
