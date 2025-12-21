import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle, Lock, Unlock, Clock, User, Calendar, Download, Edit, X, Plus, Trash2, FileText } from "lucide-react";
import { format, getWeek, getYear } from "date-fns";
import { sv } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateOBDistribution } from "@/lib/obDistribution";
import { calculateBillingOBDistribution } from "@/lib/billingOBDistribution";

interface TimeEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  total_hours: number;
  shift_type: string;
  work_description: string;
  attested_by: string | null;
  attested_at: string | null;
  invoiced: boolean;
  invoiced_at: string | null;
  invoiced_by: string | null;
  user_id: string;
  project_id: string;
  subproject_id: string | null;
  job_role_id: string;
  per_diem_type: string;
  travel_time_hours: number;
  ao_number: string | null;
  project: { name: string };
  subproject?: { name: string };
  job_role: { name: string };
  profiles: { full_name: string };
}

interface Profile {
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

interface JobRole {
  id: string;
  name: string;
}

interface MaterialType {
  id: string;
  name: string;
  unit: string;
}

interface MaterialReport {
  id: string;
  material_type_id: string;
  quantity: number;
  notes: string | null;
  material_type: { name: string; unit: string };
}

interface MaterialEntry {
  materialTypeId: string;
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
}

interface ProjectWithCustomer {
  id: string;
  name: string;
  customer_id: string | null;
  customer_name: string | null;
  location: string | null;
  work_task: string | null;
}

const TimeAttestations = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  
  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [allSubprojects, setAllSubprojects] = useState<Subproject[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [existingMaterials, setExistingMaterials] = useState<MaterialReport[]>([]);
  const [materialsToAdd, setMaterialsToAdd] = useState<MaterialEntry[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("");
  
  // Customer documentation export state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allProjectsWithCustomer, setAllProjectsWithCustomer] = useState<ProjectWithCustomer[]>([]);
  
  // Main filter state for customer/project/subproject/week
  const [filterCustomer, setFilterCustomer] = useState<string>("");
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterSubproject, setFilterSubproject] = useState<string>("");
  const [filterWeek, setFilterWeek] = useState<string>("");
  const [filterProjects, setFilterProjects] = useState<ProjectWithCustomer[]>([]);
  const [filterSubprojects, setFilterSubprojects] = useState<Subproject[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<{ key: string; label: string }[]>([]);
  const [customerAoNumber, setCustomerAoNumber] = useState<string>("");
  
  // Edit form state
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editBreakMinutes, setEditBreakMinutes] = useState("0");
  const [editProjectId, setEditProjectId] = useState("");
  const [editSubprojectId, setEditSubprojectId] = useState("");
  const [editJobRoleId, setEditJobRoleId] = useState("");
  const [editWorkDescription, setEditWorkDescription] = useState("");
  const [editPerDiemType, setEditPerDiemType] = useState("none");
  const [editTravelTimeHours, setEditTravelTimeHours] = useState("0");
  const [editAoNumber, setEditAoNumber] = useState("");

  useEffect(() => {
    fetchData();
    fetchFormData();
    fetchCustomerData();
  }, []);
  
  // Get user-relevant data based on selected user
  const userRelevantEntries = selectedUser !== "all" 
    ? entries.filter(e => e.user_id === selectedUser)
    : entries;
  
  // Get customers that the selected user has time entries for
  const availableCustomers = selectedUser !== "all"
    ? customers.filter(c => {
        const customerProjectIds = allProjectsWithCustomer
          .filter(p => p.customer_id === c.id)
          .map(p => p.id);
        return userRelevantEntries.some(e => customerProjectIds.includes(e.project_id));
      })
    : customers;
  
  // Get projects based on selected user and customer
  const availableProjects = (() => {
    let projectsToShow = allProjectsWithCustomer;
    
    // Filter by customer first if selected
    if (filterCustomer) {
      projectsToShow = projectsToShow.filter(p => p.customer_id === filterCustomer);
    }
    
    // Then filter by user if selected
    if (selectedUser !== "all") {
      const userProjectIds = new Set(userRelevantEntries.map(e => e.project_id));
      projectsToShow = projectsToShow.filter(p => userProjectIds.has(p.id));
    }
    
    return projectsToShow;
  })();
  
  // Update filtered projects when customer filter changes
  useEffect(() => {
    setFilterProjects(availableProjects);
    // Reset project/subproject if current selection is not in available list
    if (filterProject && !availableProjects.some(p => p.id === filterProject)) {
      setFilterProject("");
      setFilterSubproject("");
    }
  }, [filterCustomer, selectedUser, allProjectsWithCustomer, entries]);
  
  // Update filtered subprojects when project filter changes
  useEffect(() => {
    if (filterProject) {
      const filtered = allSubprojects.filter(sp => sp.project_id === filterProject);
      setFilterSubprojects(filtered);
      setFilterSubproject("");
    } else {
      setFilterSubprojects([]);
      setFilterSubproject("");
    }
  }, [filterProject, allSubprojects]);

  useEffect(() => {
    filterEntries();
  }, [selectedUser, selectedStatus, selectedInvoiceStatus, entries, filterCustomer, filterProject, filterSubproject, filterWeek]);
  
  // Generate available weeks from user-relevant entries
  useEffect(() => {
    const entriesToUse = userRelevantEntries;
    if (entriesToUse.length > 0) {
      const weeksSet = new Map<string, string>();
      entriesToUse.forEach((entry) => {
        const entryDate = new Date(entry.date);
        const weekNum = getWeek(entryDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
        const yearNum = getYear(entryDate);
        const weekKey = `${yearNum}-W${weekNum}`;
        if (!weeksSet.has(weekKey)) {
          weeksSet.set(weekKey, `Vecka ${weekNum}, ${yearNum}`);
        }
      });
      const sortedWeeks = Array.from(weeksSet.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => b.key.localeCompare(a.key));
      setAvailableWeeks(sortedWeeks);
    } else {
      setAvailableWeeks([]);
    }
  }, [selectedUser, entries]);
  
  useEffect(() => {
    if (editProjectId) {
      const filtered = allSubprojects.filter(sp => sp.project_id === editProjectId);
      setSubprojects(filtered);
    } else {
      setSubprojects([]);
    }
  }, [editProjectId, allSubprojects]);
  
  // Clear all filters
  const clearFilters = () => {
    setSelectedUser("all");
    setSelectedStatus("all");
    setSelectedInvoiceStatus("all");
    setFilterCustomer("");
    setFilterProject("");
    setFilterSubproject("");
    setFilterWeek("");
  };
  
  // Check if any filter is active
  const hasActiveFilters = selectedUser !== "all" || selectedStatus !== "all" || selectedInvoiceStatus !== "all" || filterCustomer || filterProject || filterSubproject || filterWeek;

  const fetchData = async () => {
    if (!user) return;

    // Fetch all time entries with user information
    const { data: entriesData } = await supabase
      .from("time_entries")
      .select(`
        *,
        project:projects(name),
        subproject:subprojects(name),
        job_role:job_roles(name),
        profiles:profiles!time_entries_user_id_fkey(full_name)
      `)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    if (entriesData) setEntries(entriesData);

    // Fetch all users for filter
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");

    if (usersData) setUsers(usersData);
  };
  
  const fetchFormData = async () => {
    // Fetch projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("active", true)
      .order("name");

    if (projectsData) setProjects(projectsData);

    // Fetch all subprojects
    const { data: subprojectsData } = await supabase
      .from("subprojects")
      .select("*")
      .eq("active", true)
      .order("name");

    if (subprojectsData) setAllSubprojects(subprojectsData);

    // Fetch job roles
    const { data: jobRolesData } = await supabase
      .from("job_roles")
      .select("*")
      .eq("active", true)
      .order("name");

    if (jobRolesData) setJobRoles(jobRolesData);

    // Fetch material types
    const { data: materialTypesData } = await supabase
      .from("material_types")
      .select("*")
      .eq("active", true)
      .order("name");

    if (materialTypesData) setMaterialTypes(materialTypesData);
  };
  
  const fetchCustomerData = async () => {
    // Fetch customers
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, name")
      .order("name");

    if (customersData) setCustomers(customersData);

    // Fetch all projects with customer info
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, customer_id, customer_name, location, work_task")
      .order("name");

    if (projectsData) {
      setAllProjectsWithCustomer(projectsData);
      setFilterProjects(projectsData);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    if (selectedUser !== "all") {
      filtered = filtered.filter(entry => entry.user_id === selectedUser);
    }

    if (selectedStatus === "attested") {
      filtered = filtered.filter(entry => entry.attested_by !== null);
    } else if (selectedStatus === "unattested") {
      filtered = filtered.filter(entry => entry.attested_by === null);
    }
    
    // Filter by invoice status
    if (selectedInvoiceStatus === "invoiced") {
      filtered = filtered.filter(entry => entry.invoiced === true);
    } else if (selectedInvoiceStatus === "not_invoiced") {
      filtered = filtered.filter(entry => entry.invoiced !== true);
    }
    
    // Filter by customer (via project's customer_id)
    if (filterCustomer) {
      const customerProjectIds = allProjectsWithCustomer
        .filter(p => p.customer_id === filterCustomer)
        .map(p => p.id);
      filtered = filtered.filter(entry => customerProjectIds.includes(entry.project_id));
    }
    
    // Filter by project
    if (filterProject) {
      filtered = filtered.filter(entry => entry.project_id === filterProject);
    }
    
    // Filter by subproject
    if (filterSubproject) {
      filtered = filtered.filter(entry => entry.subproject_id === filterSubproject);
    }
    
    // Filter by week
    if (filterWeek) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        const weekNum = getWeek(entryDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
        const yearNum = getYear(entryDate);
        const weekKey = `${yearNum}-W${weekNum}`;
        return weekKey === filterWeek;
      });
    }

    setFilteredEntries(filtered);
  };

  const handleAttest = async (entryId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          attested_by: user.id,
          attested_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Tidrapport attesterad!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (entryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          attested_by: null,
          attested_at: null,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Attestering upplåst!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string, userName: string) => {
    if (!confirm(`Är du säker på att du vill radera tidrapporten för ${userName}? Detta går inte att ångra.`)) {
      return;
    }

    setLoading(true);
    try {
      // First delete related material reports
      await supabase
        .from("material_reports")
        .delete()
        .eq("time_entry_id", entryId);

      // Then delete related deviation reports and images
      const { data: deviations } = await supabase
        .from("deviation_reports")
        .select("id")
        .eq("time_entry_id", entryId);

      if (deviations && deviations.length > 0) {
        const deviationIds = deviations.map(d => d.id);
        await supabase
          .from("deviation_images")
          .delete()
          .in("deviation_report_id", deviationIds);
        
        await supabase
          .from("deviation_reports")
          .delete()
          .eq("time_entry_id", entryId);
      }

      // Finally delete the time entry
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Tidrapport raderad!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAttest = async () => {
    if (!user) return;
    
    const unattestedIds = filteredEntries
      .filter(entry => !entry.attested_by)
      .map(entry => entry.id);

    if (unattestedIds.length === 0) {
      toast.info("Inga oattesterade tidrapporter att attestera");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          attested_by: user.id,
          attested_at: new Date().toISOString(),
        })
        .in("id", unattestedIds);

      if (error) throw error;

      toast.success(`${unattestedIds.length} tidrapporter attesterade!`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInvoiced = async (entryId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          invoiced: true,
          invoiced_by: user.id,
          invoiced_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Markerad som fakturerad!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnmarkInvoiced = async (entryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          invoiced: false,
          invoiced_by: null,
          invoiced_at: null,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Faktureringsmarkering borttagen!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMarkInvoiced = async () => {
    if (!user) return;
    
    const notInvoicedIds = filteredEntries
      .filter(entry => entry.attested_by && !entry.invoiced)
      .map(entry => entry.id);

    if (notInvoicedIds.length === 0) {
      toast.info("Inga attesterade poster att markera som fakturerade");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          invoiced: true,
          invoiced_by: user.id,
          invoiced_at: new Date().toISOString(),
        })
        .in("id", notInvoicedIds);

      if (error) throw error;

      toast.success(`${notInvoicedIds.length} tidrapporter markerade som fakturerade!`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const openEditDialog = async (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditDate(entry.date);
    setEditStartTime(entry.start_time);
    setEditEndTime(entry.end_time);
    setEditBreakMinutes(entry.break_minutes?.toString() || "0");
    setEditProjectId(entry.project_id);
    setEditSubprojectId(entry.subproject_id || "");
    setEditJobRoleId(entry.job_role_id);
    setEditWorkDescription(entry.work_description || "");
    setEditPerDiemType(entry.per_diem_type || "none");
    setEditTravelTimeHours(entry.travel_time_hours?.toString() || "0");
    setEditAoNumber(entry.ao_number || "");
    setMaterialsToAdd([]);
    setSelectedMaterial("");
    setMaterialQuantity("");
    
    // Fetch existing material reports for this time entry
    const { data: materialsData } = await supabase
      .from("material_reports")
      .select(`
        *,
        material_type:material_types(name, unit)
      `)
      .eq("time_entry_id", entry.id);
    
    if (materialsData) {
      setExistingMaterials(materialsData);
    } else {
      setExistingMaterials([]);
    }
    
    setShowEditDialog(true);
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
    const dayOfWeek = workDate.getDay();
    
    const [startHour] = startTime.split(':').map(Number);
    
    const isFridayEvening = dayOfWeek === 5 && startHour >= 18;
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isMondayMorning = dayOfWeek === 1 && startHour < 7;
    
    if (isFridayEvening || isSaturday || isSunday || isMondayMorning) {
      return "weekend";
    }
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 4;
    
    if (isWeekday) {
      if (startHour >= 21 || startHour < 6) {
        return "night";
      }
      
      if (startHour >= 18 && startHour < 21) {
        return "evening";
      }
    }
    
    return "day";
  };
  
  const addMaterialToList = () => {
    if (!selectedMaterial || !materialQuantity) {
      toast.error("Välj material och ange kvantitet");
      return;
    }

    const quantity = parseFloat(materialQuantity);
    if (quantity <= 0) {
      toast.error("Kvantitet måste vara större än 0");
      return;
    }

    // Check if already in new materials list
    if (materialsToAdd.some(m => m.materialTypeId === selectedMaterial)) {
      toast.error("Materialet är redan tillagt");
      return;
    }

    // Check if already exists in existing materials
    if (existingMaterials.some(m => m.material_type_id === selectedMaterial)) {
      toast.error("Materialet finns redan, redigera det istället");
      return;
    }

    setMaterialsToAdd([...materialsToAdd, { materialTypeId: selectedMaterial, quantity }]);
    setSelectedMaterial("");
    setMaterialQuantity("");
  };

  const removeMaterialFromList = (materialTypeId: string) => {
    setMaterialsToAdd(materialsToAdd.filter(m => m.materialTypeId !== materialTypeId));
  };

  const updateExistingMaterialQuantity = async (materialId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      toast.error("Kvantitet måste vara större än 0");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("material_reports")
        .update({ quantity: newQuantity })
        .eq("id", materialId);

      if (error) throw error;

      // Update local state
      setExistingMaterials(existingMaterials.map(m => 
        m.id === materialId ? { ...m, quantity: newQuantity } : m
      ));
      
      toast.success("Kvantitet uppdaterad!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteExistingMaterial = async (materialId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("material_reports")
        .delete()
        .eq("id", materialId);

      if (error) throw error;

      setExistingMaterials(existingMaterials.filter(m => m.id !== materialId));
      toast.success("Material borttaget!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    
    setLoading(true);
    try {
      const totalHours = calculateHours(editStartTime, editEndTime, parseInt(editBreakMinutes));
      const calculatedShiftType = determineShiftType(editDate, editStartTime, editEndTime);
      
      if (totalHours <= 0) {
        toast.error("Sluttid måste vara efter starttid");
        setLoading(false);
        return;
      }
      
      const { error } = await supabase
        .from("time_entries")
        .update({
          date: editDate,
          start_time: editStartTime,
          end_time: editEndTime,
          break_minutes: parseInt(editBreakMinutes),
          project_id: editProjectId,
          subproject_id: editSubprojectId || null,
          job_role_id: editJobRoleId,
          shift_type: calculatedShiftType as any,
          work_description: editWorkDescription.trim(),
          total_hours: totalHours,
          per_diem_type: editPerDiemType,
          travel_time_hours: parseFloat(editTravelTimeHours) || 0,
          ao_number: editAoNumber.trim() || null,
        })
        .eq("id", editingEntry.id);

      if (error) throw error;

      // Add new materials if any
      if (materialsToAdd.length > 0) {
        const materialReports = materialsToAdd.map(material => ({
          time_entry_id: editingEntry.id,
          material_type_id: material.materialTypeId,
          quantity: material.quantity,
        }));

        const { error: materialsError } = await supabase
          .from("material_reports")
          .insert(materialReports);

        if (materialsError) throw materialsError;
      }

      toast.success("Tidrapport uppdaterad!");
      setShowEditDialog(false);
      setEditingEntry(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async (userId: string, userName: string) => {
    try {
      // Fetch user's attested time entries
      const { data: userEntries } = await supabase
        .from("time_entries")
        .select(`
          *,
          project:projects(name),
          subproject:subprojects(name),
          job_role:job_roles(name)
        `)
        .eq("user_id", userId)
        .not("attested_by", "is", null)
        .order("date", { ascending: true });

      if (!userEntries || userEntries.length === 0) {
        toast.error("Inga attesterade tidrapporter att exportera");
        return;
      }

      // Fetch deviations for this user
      const { data: deviations } = await supabase
        .from("deviation_reports")
        .select("*")
        .eq("user_id", userId)
        .in("time_entry_id", userEntries.map(e => e.id));

      const doc = new jsPDF();
      
      // Add logo
      const logo = new Image();
      logo.src = "/railwork-logo.jpg";
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve;
      });
      
      if (logo.complete) {
        doc.addImage(logo, "JPEG", 14, 10, 40, 20);
      }

      // Header
      doc.setFontSize(20);
      doc.text("Tidrapport - Sammanställning", 105, 25, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Anställd: ${userName}`, 14, 40);
      doc.text(`Exportdatum: ${format(new Date(), "d MMMM yyyy", { locale: sv })}`, 14, 46);
      doc.text(`Period: ${format(new Date(userEntries[0].date), "d MMM yyyy", { locale: sv })} - ${format(new Date(userEntries[userEntries.length - 1].date), "d MMM yyyy", { locale: sv })}`, 14, 52);

      // Calculate totals
      let totalHours = 0;
      let totalDay = 0;
      let totalEvening = 0;
      let totalNight = 0;
      let totalWeekend = 0;
      let totalTravelCompensation = 0;
      let totalPerDiemCompensation = 0;
      
      // Track per diem by date (max one per day)
      const perDiemByDate: Record<string, string> = {};

      const tableData = userEntries.map((entry) => {
        const ob = calculateOBDistribution(
          entry.date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes
        );

        totalHours += entry.total_hours;
        totalDay += ob.day;
        totalEvening += ob.evening;
        totalNight += ob.night;
        totalWeekend += ob.weekend;
        
        // Calculate travel compensation
        if (entry.travel_time_hours) {
          totalTravelCompensation += entry.travel_time_hours * 170;
        }
        
        // Track per diem (max one per day)
        if (entry.per_diem_type && entry.per_diem_type !== 'none') {
          const existingPerDiem = perDiemByDate[entry.date];
          if (!existingPerDiem || (entry.per_diem_type === 'full' && existingPerDiem === 'half')) {
            perDiemByDate[entry.date] = entry.per_diem_type;
          }
        }

        const deviation = deviations?.find(d => d.time_entry_id === entry.id);
        
        const travelInfo = entry.travel_time_hours > 0 ? `${entry.travel_time_hours}h` : "-";
        const perDiemInfo = entry.per_diem_type === 'full' ? 'Hel' : entry.per_diem_type === 'half' ? 'Halv' : '-';

        return [
          format(new Date(entry.date), "yyyy-MM-dd"),
          entry.project?.name || "-",
          entry.subproject?.name || "-",
          `${entry.start_time} - ${entry.end_time}`,
          entry.break_minutes,
          entry.total_hours.toFixed(2),
          ob.day.toFixed(2),
          ob.evening.toFixed(2),
          ob.night.toFixed(2),
          ob.weekend.toFixed(2),
          travelInfo,
          perDiemInfo,
          entry.work_description || "-",
          deviation ? "Ja" : "Nej"
        ];
      });
      
      // Calculate total per diem compensation
      Object.values(perDiemByDate).forEach((type) => {
        if (type === 'full') {
          totalPerDiemCompensation += 290;
        } else if (type === 'half') {
          totalPerDiemCompensation += 145;
        }
      });
      const perDiemDays = Object.keys(perDiemByDate).length;

      // Time entries table
      autoTable(doc, {
        startY: 60,
        head: [[
          "Datum",
          "Projekt",
          "Under-\nprojekt",
          "Tid",
          "Rast\n(min)",
          "Tot\n(h)",
          "Dag\n(h)",
          "Kväll\n(h)",
          "Natt\n(h)",
          "Helg\n(h)",
          "Restid\n(h)",
          "Trakt.",
          "Beskrivning",
          "Avv."
        ]],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 10 },
          5: { cellWidth: 10 },
          6: { cellWidth: 10 },
          7: { cellWidth: 10 },
          8: { cellWidth: 10 },
          9: { cellWidth: 10 },
          10: { cellWidth: 10 },
          11: { cellWidth: 10 },
          12: { cellWidth: 25 },
          13: { cellWidth: 10 }
        },
        margin: { left: 14, right: 14 },
      });

      // Summary table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setFontSize(14);
      doc.text("Sammanfattning", 14, finalY);

      autoTable(doc, {
        startY: finalY + 5,
        head: [["Kategori", "Värde"]],
        body: [
          ["Totalt arbetstid", `${totalHours.toFixed(2)} h`],
          ["Dagtid (07:00-18:00 Mån-Fre)", `${totalDay.toFixed(2)} h`],
          ["Kvällstid (18:00-21:00 Mån-Tor)", `${totalEvening.toFixed(2)} h`],
          ["Nattetid (21:00-06:00 Mån-Tor)", `${totalNight.toFixed(2)} h`],
          ["Helgtid (18:00 Fre - 07:00 Mån)", `${totalWeekend.toFixed(2)} h`],
          ["", ""],
          ["Restid", `${userEntries.reduce((sum, e) => sum + (e.travel_time_hours || 0), 0).toFixed(2)} h`],
          ["Traktamente", `${perDiemDays} dagar`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [52, 152, 219], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 60, halign: "right" }
        },
        margin: { left: 14 },
      });

      // Deviations section
      if (deviations && deviations.length > 0) {
        const deviationY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(14);
        doc.text("Avvikelser", 14, deviationY);

        const deviationData = deviations.map(dev => {
          const entry = userEntries.find(e => e.id === dev.time_entry_id);
          return [
            format(new Date(entry?.date || ""), "yyyy-MM-dd"),
            dev.title,
            dev.description,
            dev.severity || "-",
            dev.status || "-"
          ];
        });

        autoTable(doc, {
          startY: deviationY + 5,
          head: [["Datum", "Titel", "Beskrivning", "Allvarlighetsgrad", "Status"]],
          body: deviationData,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [231, 76, 60], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 60 },
            3: { cellWidth: 30 },
            4: { cellWidth: 25 }
          },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Sida ${i} av ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Save PDF
      doc.save(`Tidrapport_${userName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF genererad!");
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast.error("Kunde inte generera PDF: " + error.message);
    }
  };

  const exportCustomerDocumentation = async () => {
    if (!filterCustomer && !filterProject) {
      toast.error("Välj minst en kund eller ett projekt");
      return;
    }

    try {
      // Build the query for attested time entries
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          project:projects(id, name, customer_id, customer_name, location, work_task),
          subproject:subprojects(id, name),
          job_role:job_roles(name),
          profiles:profiles(full_name)
        `)
        .not("attested_by", "is", null)
        .order("date", { ascending: true });

      // Filter by project if selected
      if (filterProject) {
        query = query.eq("project_id", filterProject);
      }
      
      // Filter by subproject if selected
      if (filterSubproject) {
        query = query.eq("subproject_id", filterSubproject);
      }

      const { data: customerEntries, error } = await query;

      if (error) throw error;

      // If filtering by customer (not project), filter the results
      let docFilteredEntries = customerEntries || [];
      if (filterCustomer && !filterProject) {
        docFilteredEntries = docFilteredEntries.filter(
          entry => entry.project?.customer_id === filterCustomer
        );
      }

      if (docFilteredEntries.length === 0) {
        toast.error("Inga attesterade tidrapporter hittades för vald kund/projekt");
        return;
      }

      // Get customer/project info for header
      const customerName = filterCustomer 
        ? customers.find(c => c.id === filterCustomer)?.name 
        : docFilteredEntries[0]?.project?.customer_name || "Okänd kund";
      const projectInfo = filterProject 
        ? filterProjects.find(p => p.id === filterProject) 
        : null;
      const subprojectInfo = filterSubproject
        ? filterSubprojects.find(sp => sp.id === filterSubproject)
        : null;

      const doc = new jsPDF();
      
      // Add logo
      const logo = new Image();
      logo.src = "/railwork-logo.jpg";
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve;
      });
      
      if (logo.complete) {
        doc.addImage(logo, "JPEG", 14, 10, 40, 20);
      }

      // Header
      doc.setFontSize(18);
      doc.text("Kundunderlag - Dagbok & Sammanfattning", 105, 20, { align: "center" });
      
      doc.setFontSize(11);
      let yPos = 38;
      doc.text(`Kund: ${customerName}`, 14, yPos);
      yPos += 6;
      if (projectInfo) {
        doc.text(`Projekt: ${projectInfo.name}`, 14, yPos);
        yPos += 6;
        if (projectInfo.location) {
          doc.text(`Plats: ${projectInfo.location}`, 14, yPos);
          yPos += 6;
        }
        if (projectInfo.work_task) {
          doc.text(`Arbetsuppgift: ${projectInfo.work_task}`, 14, yPos);
          yPos += 6;
        }
      }
      if (subprojectInfo) {
        doc.text(`Underprojekt: ${subprojectInfo.name}`, 14, yPos);
        yPos += 6;
      }
      if (customerAoNumber) {
        doc.text(`AO-nummer: ${customerAoNumber}`, 14, yPos);
        yPos += 6;
      }
      doc.text(`Exportdatum: ${format(new Date(), "d MMMM yyyy", { locale: sv })}`, 14, yPos);
      yPos += 6;
      doc.text(`Period: ${format(new Date(filteredEntries[0].date), "d MMM yyyy", { locale: sv })} - ${format(new Date(filteredEntries[filteredEntries.length - 1].date), "d MMM yyyy", { locale: sv })}`, 14, yPos);

      // Fetch material reports for these entries
      const entryIds = filteredEntries.map(e => e.id);
      const { data: materialReports } = await supabase
        .from("material_reports")
        .select(`
          *,
          material_type:material_types(name, unit)
        `)
        .in("time_entry_id", entryIds);

      // Calculate totals using billing-specific OB distribution
      let totalHours = 0;
      let totalDay = 0;
      let totalNight = 0;
      let totalWeekend = 0;
      let totalTravelHours = 0;
      let totalFullPerDiem = 0;
      let totalHalfPerDiem = 0;

      // Track vehicles used
      const vehiclesUsed = new Set<string>();

      // Aggregate materials
      const materialSummary: Record<string, { name: string; unit: string; quantity: number }> = {};

      // Process material reports
      materialReports?.forEach((mr) => {
        const key = mr.material_type_id;
        if (!materialSummary[key]) {
          materialSummary[key] = {
            name: mr.material_type?.name || "Okänd",
            unit: mr.material_type?.unit || "st",
            quantity: 0
          };
        }
        materialSummary[key].quantity += Number(mr.quantity);
      });

      // Dagbok (diary) table data
      const diaryData = filteredEntries.map((entry) => {
        // Use billing OB distribution (Dag/Natt/Helg)
        const ob = calculateBillingOBDistribution(
          entry.date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes
        );

        totalHours += entry.total_hours;
        totalDay += ob.day;
        totalNight += ob.night;
        totalWeekend += ob.weekend;
        totalTravelHours += entry.travel_time_hours || 0;

        // Count per diem
        if (entry.per_diem_type === "full") totalFullPerDiem++;
        if (entry.per_diem_type === "half") totalHalfPerDiem++;

        const weekNum = getWeek(new Date(entry.date), { weekStartsOn: 1, firstWeekContainsDate: 4 });
        
        return [
          `v.${weekNum}`,
          format(new Date(entry.date), "yyyy-MM-dd"),
          entry.profiles?.full_name || "-",
          entry.job_role?.name || "-",
          (entry as any).ao_number || "-",
          `${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)}`,
          entry.break_minutes,
          entry.total_hours.toFixed(2),
          entry.travel_time_hours?.toFixed(2) || "0",
          entry.work_description || "-"
        ];
      });

      // Fetch scheduled assignments for vehicles (optional)
      if (filterProject) {
        const { data: assignments } = await supabase
          .from("scheduled_assignments")
          .select("vehicle")
          .eq("project_id", filterProject)
          .not("vehicle", "is", null);
        
        assignments?.forEach((a) => {
          if (a.vehicle) vehiclesUsed.add(a.vehicle);
        });
      }

      // Dagbok table
      yPos += 10;
      doc.setFontSize(14);
      doc.text("Dagbok", 14, yPos);

      autoTable(doc, {
        startY: yPos + 5,
        head: [[
          "Vecka",
          "Datum",
          "Anställd",
          "Roll",
          "AO-nr",
          "Tid",
          "Rast\n(min)",
          "Tim\n(h)",
          "Restid\n(h)",
          "Arbetsbeskrivning"
        ]],
        body: diaryData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 18 },
          2: { cellWidth: 22 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 18 },
          6: { cellWidth: 10 },
          7: { cellWidth: 10 },
          8: { cellWidth: 10 },
          9: { cellWidth: 46 }
        },
        margin: { left: 14, right: 14 },
      });

      // Summary section
      const summaryY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(14);
      doc.text("Sammanfattning", 14, summaryY);

      // Build summary rows
      const summaryRows: [string, string][] = [
        ["Totalt arbetstid", `${totalHours.toFixed(2)} h`],
        ["", ""],
        ["Tidsfördelning (fakturering):", ""],
        ["  Dag (06:00-18:00 Mån-Fre)", `${totalDay.toFixed(2)} h`],
        ["  Natt (18:00-06:00 Mån-Tor)", `${totalNight.toFixed(2)} h`],
        ["  Helg (Fre 18:00 - Mån 06:00)", `${totalWeekend.toFixed(2)} h`],
        ["", ""],
        ["Restid totalt", `${totalTravelHours.toFixed(2)} h`],
      ];

      // Add per diem (traktamente)
      if (totalFullPerDiem > 0 || totalHalfPerDiem > 0) {
        summaryRows.push(["", ""]);
        summaryRows.push(["Traktamente:", ""]);
        if (totalFullPerDiem > 0) {
          summaryRows.push(["  Hel traktamente", `${totalFullPerDiem} dagar`]);
        }
        if (totalHalfPerDiem > 0) {
          summaryRows.push(["  Halv traktamente", `${totalHalfPerDiem} dagar`]);
        }
      }

      // Add vehicles
      if (vehiclesUsed.size > 0) {
        summaryRows.push(["", ""]);
        summaryRows.push(["Fordon:", ""]);
        Array.from(vehiclesUsed).forEach((vehicle) => {
          summaryRows.push([`  ${vehicle}`, ""]);
        });
      }

      // Add materials (tillägg)
      const materialEntries = Object.values(materialSummary);
      if (materialEntries.length > 0) {
        summaryRows.push(["", ""]);
        summaryRows.push(["Tillägg/Material:", ""]);
        materialEntries.forEach((mat) => {
          summaryRows.push([`  ${mat.name}`, `${mat.quantity} ${mat.unit}`]);
        });
      }

      autoTable(doc, {
        startY: summaryY + 5,
        head: [["Kategori", "Värde"]],
        body: summaryRows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [52, 152, 219], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 50, halign: "right" }
        },
        margin: { left: 14 },
      });

      // Footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Sida ${i} av ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 25,
          { align: "center" }
        );
      }

      // Promotional footer on last page
      doc.setPage(pageCount);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Draw a subtle separator line
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(pageWidth * 0.2, pageHeight - 28, pageWidth * 0.8, pageHeight - 28);
      
      // Opero branding
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("OPERO", pageWidth / 2, pageHeight - 22, { align: "center" });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Operativsystem för företag", pageWidth / 2, pageHeight - 17, { align: "center" });
      
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text("Dagbok  •  Kundunderlag  •  Kvalitetssystem  •  Full kontroll", pageWidth / 2, pageHeight - 12, { align: "center" });
      
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text("Boka demo: edgar@railwork.se", pageWidth / 2, pageHeight - 6, { align: "center" });
      
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");

      // Generate filename
      const filenameParts = ["Kundunderlag"];
      if (customerName) filenameParts.push(customerName.replace(/\s+/g, "_"));
      if (projectInfo) filenameParts.push(projectInfo.name.replace(/\s+/g, "_"));
      if (subprojectInfo) filenameParts.push(subprojectInfo.name.replace(/\s+/g, "_"));
      filenameParts.push(format(new Date(), "yyyy-MM-dd"));
      
      doc.save(`${filenameParts.join("_")}.pdf`);
      toast.success("Kundunderlag PDF genererad!");
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast.error("Kunde inte generera PDF: " + error.message);
    }
  };

  // Calculate weeks for summary (current + 3 previous = 4 weeks)
  const getWeekKey = (date: Date) => {
    const weekNum = getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
    const yearNum = getYear(date);
    return `${yearNum}-W${weekNum}`;
  };

  const now = new Date();
  const currentWeekNum = getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  
  // Generate last 4 weeks
  const last4Weeks: { key: string; label: string; weekNum: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeek(weekDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
    const yearNum = getYear(weekDate);
    last4Weeks.push({
      key: `${yearNum}-W${weekNum}`,
      label: i === 0 ? `Denna vecka (v${weekNum})` : `Vecka ${weekNum}`,
      weekNum
    });
  }

  // Get unattested entries per week
  const unattestedPerWeek = last4Weeks.map(week => {
    const weekEntries = entries.filter(entry => {
      const entryWeekKey = getWeekKey(new Date(entry.date));
      return entryWeekKey === week.key && !entry.attested_by;
    });
    
    const byUser = weekEntries.reduce((acc, entry) => {
      const userName = entry.profiles?.full_name || "Okänd";
      const userId = entry.user_id;
      if (!acc[userId]) {
        acc[userId] = { name: userName, count: 0 };
      }
      acc[userId].count++;
      return acc;
    }, {} as Record<string, { name: string; count: number }>);
    
    return {
      ...week,
      entries: weekEntries,
      byUser: Object.entries(byUser).sort((a, b) => b[1].count - a[1].count)
    };
  });

  // Total unattested across all 4 weeks
  const totalUnattested = unattestedPerWeek.reduce((sum, week) => sum + week.entries.length, 0);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">Attestering av tidrapporter</h2>
        <p className="text-muted-foreground">Granska och attestera användarnas tidrapporter</p>
      </div>

      {/* Weeks Ready for Billing */}
      <Card className="mb-6 shadow-card border-l-4 border-l-green-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Klart för fakturering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {last4Weeks.map(week => {
              const weekEntries = entries.filter(entry => getWeekKey(new Date(entry.date)) === week.key);
              const allAttested = weekEntries.length > 0 && weekEntries.every(entry => entry.attested_by);
              const hasEntries = weekEntries.length > 0;
              const attestedCount = weekEntries.filter(entry => entry.attested_by).length;
              
              return (
                <div 
                  key={week.key} 
                  className={`p-3 rounded-lg border ${
                    allAttested 
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                      : hasEntries 
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
                        : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="font-medium text-sm mb-1">{week.label}</div>
                  {allAttested ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Klart för fakturering</span>
                    </div>
                  ) : hasEntries ? (
                    <div className="text-sm text-orange-600 dark:text-orange-400">
                      {attestedCount}/{weekEntries.length} attesterade
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Inga rapporter</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4 Week Summary */}
      <Card className="mb-6 shadow-card border-l-4 border-l-orange-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Oattesterade tidrapporter (senaste 4 veckorna)
            {totalUnattested > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 ml-2">
                {totalUnattested} totalt
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalUnattested === 0 ? (
            <p className="text-muted-foreground">Inga oattesterade tidrapporter de senaste 4 veckorna.</p>
          ) : (
            <div className="space-y-4">
              {unattestedPerWeek.map(week => (
                <div key={week.key} className={`${week.entries.length === 0 ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{week.label}</span>
                    {week.entries.length > 0 ? (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 text-xs">
                        {week.entries.length} {week.entries.length === 1 ? 'rapport' : 'rapporter'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Klart
                      </Badge>
                    )}
                  </div>
                  {week.byUser.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-4">
                      {week.byUser.map(([userId, data]) => (
                        <Badge 
                          key={userId} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-accent text-xs"
                          onClick={() => {
                            setSelectedUser(userId);
                            setSelectedStatus("unattested");
                            setFilterWeek(week.key);
                          }}
                        >
                          <User className="h-3 w-3 mr-1" />
                          {data.name}: {data.count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Användare</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla användare" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla användare</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Atteststatus</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla</SelectItem>
                  <SelectItem value="unattested">Oattesterade</SelectItem>
                  <SelectItem value="attested">Attesterade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fakturering</label>
              <Select value={selectedInvoiceStatus} onValueChange={setSelectedInvoiceStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla</SelectItem>
                  <SelectItem value="not_invoiced">Ej fakturerade</SelectItem>
                  <SelectItem value="invoiced">Fakturerade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Kund</label>
              <Select value={filterCustomer || "__all__"} onValueChange={(val) => setFilterCustomer(val === "__all__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla kunder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla kunder</SelectItem>
                  {availableCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Projekt</label>
              <Select value={filterProject || "__all__"} onValueChange={(val) => setFilterProject(val === "__all__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla projekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla projekt</SelectItem>
                  {filterProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Underprojekt</label>
              <Select 
                value={filterSubproject || "__all__"} 
                onValueChange={(val) => setFilterSubproject(val === "__all__" ? "" : val)}
                disabled={!filterProject || filterSubprojects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterProject ? "Alla underprojekt" : "Välj projekt först"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla underprojekt</SelectItem>
                  {filterSubprojects.map((subproject) => (
                    <SelectItem key={subproject.id} value={subproject.id}>
                      {subproject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Vecka</label>
              <Select value={filterWeek || "__all__"} onValueChange={(val) => setFilterWeek(val === "__all__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla veckor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla veckor</SelectItem>
                  {availableWeeks.map((week) => (
                    <SelectItem key={week.key} value={week.key}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {hasActiveFilters && (
              <Button 
                onClick={clearFilters} 
                variant="outline"
                className="border-muted-foreground/30"
              >
                <X className="mr-2 h-4 w-4" />
                Rensa filter
              </Button>
            )}
            <Button 
              onClick={handleBulkAttest} 
              disabled={loading}
              className="bg-gradient-primary"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Attestera alla filtrerade
            </Button>
            
            <Button
              onClick={() => {
                if (selectedUser === "all") {
                  toast.error("Välj en specifik användare för att exportera PDF");
                  return;
                }
                const selectedUserData = users.find(u => u.id === selectedUser);
                if (selectedUserData) {
                  exportToPDF(selectedUser, selectedUserData.full_name);
                }
              }} 
              disabled={loading || selectedUser === "all"}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportera PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Documentation Export */}
      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Kundunderlag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Exportera dagbok och sammanfattning för en kund, projekt eller underprojekt.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kund</label>
              <Select value={filterCustomer || "__all__"} onValueChange={(val) => setFilterCustomer(val === "__all__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla kunder</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Projekt</label>
              <Select value={filterProject || "__all__"} onValueChange={(val) => setFilterProject(val === "__all__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj projekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla projekt</SelectItem>
                  {filterProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Underprojekt</label>
              <Select 
                value={filterSubproject || "__all__"} 
                onValueChange={(val) => setFilterSubproject(val === "__all__" ? "" : val)}
                disabled={!filterProject || filterSubprojects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterProject ? "Välj underprojekt" : "Välj projekt först"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla underprojekt</SelectItem>
                  {filterSubprojects.map((subproject) => (
                    <SelectItem key={subproject.id} value={subproject.id}>
                      {subproject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">AO-nummer (frivilligt)</label>
              <Input 
                placeholder="Ange AO-nummer"
                value={customerAoNumber}
                onChange={(e) => setCustomerAoNumber(e.target.value)}
              />
            </div>
          </div>
          
          <div className="mt-4">
            <Button 
              onClick={exportCustomerDocumentation}
              disabled={loading || (!filterCustomer && !filterProject)}
              className="bg-gradient-primary"
            >
              <Download className="mr-2 h-4 w-4" />
              Ladda ner kundunderlag (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Inga tidrapporter hittades</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          (() => {
            // Group entries by week
            const entriesByWeek: { [key: string]: TimeEntry[] } = {};
            filteredEntries.forEach((entry) => {
              const entryDate = new Date(entry.date);
              const weekNum = getWeek(entryDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
              const yearNum = getYear(entryDate);
              const weekKey = `${yearNum}-W${weekNum}`;
              if (!entriesByWeek[weekKey]) {
                entriesByWeek[weekKey] = [];
              }
              entriesByWeek[weekKey].push(entry);
            });

            // Sort weeks descending (newest first)
            const sortedWeeks = Object.keys(entriesByWeek).sort((a, b) => b.localeCompare(a));

            return sortedWeeks.map((weekKey) => {
              const weekEntries = entriesByWeek[weekKey];
              const [year, week] = weekKey.split("-W");
              const totalHoursInWeek = weekEntries.reduce((sum, e) => sum + e.total_hours, 0);
              const attestedCount = weekEntries.filter(e => e.attested_by).length;
              
              return (
                <div key={weekKey} className="space-y-3">
                  {/* Week header */}
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border">
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="text-sm font-semibold px-3 py-1">
                        Vecka {week}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{year}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {weekEntries.length} {weekEntries.length === 1 ? "rapport" : "rapporter"}
                      </span>
                      <span className="font-medium">{totalHoursInWeek.toFixed(1)}h totalt</span>
                      <Badge variant={attestedCount === weekEntries.length ? "secondary" : "outline"} className={attestedCount === weekEntries.length ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}>
                        {attestedCount}/{weekEntries.length} attesterade
                      </Badge>
                    </div>
                  </div>

                  {/* Week entries */}
                  {weekEntries.map((entry) => (
                    <Card key={entry.id} className="shadow-card hover:shadow-elevated transition-shadow ml-4">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{entry.profiles?.full_name}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="font-medium">
                                {format(new Date(entry.date), "EEEE d MMMM", { locale: sv })}
                              </span>
                              {entry.attested_by && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Attesterad
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{entry.start_time} - {entry.end_time}</span>
                              <span>({entry.total_hours.toFixed(2)}h)</span>
                              <span>• Rast: {entry.break_minutes} min</span>
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
                              {entry.ao_number && (
                                <div>
                                  <span className="text-muted-foreground">AO:</span>{" "}
                                  <span className="font-medium">{entry.ao_number}</span>
                                </div>
                              )}
                            </div>

                            {(entry.travel_time_hours > 0 || entry.per_diem_type !== 'none') && (
                              <div className="flex items-center gap-4 text-sm mt-2 pt-2 border-t">
                                {entry.travel_time_hours > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Restid:</span>{" "}
                                    <span className="font-medium">{entry.travel_time_hours}h</span>
                                  </div>
                                )}
                                {entry.per_diem_type !== 'none' && (
                                  <div>
                                    <span className="text-muted-foreground">Traktamente:</span>{" "}
                                    <span className="font-medium">
                                      {entry.per_diem_type === 'full' ? 'Hel' : 'Halv'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {entry.work_description && (
                              <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                                {entry.work_description}
                              </p>
                            )}

                            {entry.attested_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                Attesterad: {format(new Date(entry.attested_at), "d MMM yyyy HH:mm", { locale: sv })}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(entry)}
                              disabled={loading}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Redigera
                            </Button>
                            {entry.attested_by ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnlock(entry.id)}
                                disabled={loading}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                              >
                                <Unlock className="h-4 w-4 mr-1" />
                                Lås upp
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAttest(entry.id)}
                                disabled={loading}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                              >
                                <Lock className="h-4 w-4 mr-1" />
                                Attestera
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(entry.id, entry.profiles?.full_name || "användaren")}
                              disabled={loading}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Radera
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            });
          })()
        )}
      </div>
      
      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera tidrapport</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDate">Datum</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editBreakMinutes">Rast (minuter)</Label>
                <Select value={editBreakMinutes} onValueChange={setEditBreakMinutes}>
                  <SelectTrigger id="editBreakMinutes">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStartTime">Starttid</Label>
                <Input
                  id="editStartTime"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editEndTime">Sluttid</Label>
                <Input
                  id="editEndTime"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editProject">Projekt</Label>
                <Select value={editProjectId} onValueChange={setEditProjectId} required>
                  <SelectTrigger id="editProject">
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
              
              <div className="space-y-2">
                <Label htmlFor="editSubproject">Underprojekt (valfritt)</Label>
                <div className="flex gap-2">
                  <Select value={editSubprojectId || undefined} onValueChange={setEditSubprojectId}>
                    <SelectTrigger id="editSubproject">
                      <SelectValue placeholder="Inget underprojekt valt" />
                    </SelectTrigger>
                    <SelectContent>
                      {subprojects.map((subproject) => (
                        <SelectItem key={subproject.id} value={subproject.id}>
                          {subproject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editSubprojectId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSubprojectId("")}
                    >
                      Rensa
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editJobRole">Arbetsroll</Label>
              <Select value={editJobRoleId} onValueChange={setEditJobRoleId} required>
                <SelectTrigger id="editJobRole">
                  <SelectValue placeholder="Välj arbetsroll" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editWorkDescription">Arbetsbeskrivning (valfritt)</Label>
              <Textarea
                id="editWorkDescription"
                value={editWorkDescription}
                onChange={(e) => setEditWorkDescription(e.target.value)}
                placeholder="Beskriv arbetet..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editPerDiem">Traktamente</Label>
                <Select value={editPerDiemType} onValueChange={setEditPerDiemType}>
                  <SelectTrigger id="editPerDiem">
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
                <Label htmlFor="editTravelTime">Restidsersättning (timmar)</Label>
                <Input
                  id="editTravelTime"
                  type="number"
                  value={editTravelTimeHours}
                  onChange={(e) => setEditTravelTimeHours(e.target.value)}
                  min="0"
                  step="0.5"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAoNumber">AO-nummer (valfritt)</Label>
              <Input
                id="editAoNumber"
                type="text"
                value={editAoNumber}
                onChange={(e) => setEditAoNumber(e.target.value)}
                placeholder="Ange AO-nummer"
              />
            </div>

            {/* Existing Materials Section */}
            {existingMaterials.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Befintliga tillägg</Label>
                <div className="space-y-2">
                  {existingMaterials.map((material) => (
                    <div key={material.id} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <span className="font-medium">{material.material_type.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({material.material_type.unit})
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={material.quantity}
                        onChange={(e) => {
                          const newQty = parseFloat(e.target.value);
                          if (newQty > 0) {
                            setExistingMaterials(existingMaterials.map(m => 
                              m.id === material.id ? { ...m, quantity: newQty } : m
                            ));
                          }
                        }}
                        onBlur={(e) => {
                          const newQty = parseFloat(e.target.value);
                          if (newQty !== material.quantity && newQty > 0) {
                            updateExistingMaterialQuantity(material.id, newQty);
                          }
                        }}
                        className="w-24"
                        min="0.01"
                        step="0.01"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExistingMaterial(material.id)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Materials Section */}
            <div className="space-y-2 pt-4 border-t">
              <Label>Lägg till tillägg</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialTypes
                      .filter(mt => 
                        !existingMaterials.some(em => em.material_type_id === mt.id) &&
                        !materialsToAdd.some(ma => ma.materialTypeId === mt.id)
                      )
                      .map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.unit})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={materialQuantity}
                  onChange={(e) => setMaterialQuantity(e.target.value)}
                  placeholder="Kvantitet"
                  min="0.01"
                  step="0.01"
                />
                <Button type="button" variant="outline" onClick={addMaterialToList}>
                  <Plus className="h-4 w-4 mr-1" />
                  Lägg till
                </Button>
              </div>

              {materialsToAdd.length > 0 && (
                <div className="space-y-2 mt-2">
                  {materialsToAdd.map((material) => {
                    const materialType = materialTypes.find(mt => mt.id === material.materialTypeId);
                    return (
                      <div key={material.materialTypeId} className="flex items-center gap-2 p-2 border rounded bg-muted/50">
                        <div className="flex-1">
                          <span className="font-medium">{materialType?.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {material.quantity} {materialType?.unit}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMaterialFromList(material.materialTypeId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-primary">
                {loading ? "Sparar..." : "Spara ändringar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeAttestations;