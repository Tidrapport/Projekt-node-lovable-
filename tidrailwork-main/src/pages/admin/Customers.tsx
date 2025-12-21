import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, Download, Plus, Edit, Trash2, FolderKanban, Layers } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateOBDistribution } from "@/lib/obDistribution";

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string | null;
  customer_name: string | null;
}

interface Subproject {
  id: string;
  name: string;
  project_id: string;
}

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
  user_id: string;
  project_id: string;
  subproject_id: string | null;
  per_diem_type: string;
  travel_time_hours: number;
  project: { name: string };
  subproject?: { name: string };
  profiles: { full_name: string };
}

const AdminCustomers = () => {
  const { companyId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedSubproject, setSelectedSubproject] = useState<string>("all");

  // Customer dialog state
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");

  // Filtered data
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [filteredSubprojects, setFilteredSubprojects] = useState<Subproject[]>([]);
  const [attestedEntries, setAttestedEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Filter projects by selected customer
    if (selectedCustomer === "all") {
      setFilteredProjects(projects);
    } else {
      setFilteredProjects(projects.filter(p => p.customer_id === selectedCustomer));
    }
    setSelectedProject("all");
    setSelectedSubproject("all");
  }, [selectedCustomer, projects]);

  useEffect(() => {
    // Filter subprojects by selected project
    if (selectedProject === "all") {
      setFilteredSubprojects([]);
    } else {
      setFilteredSubprojects(subprojects.filter(sp => sp.project_id === selectedProject));
    }
    setSelectedSubproject("all");
  }, [selectedProject, subprojects]);

  useEffect(() => {
    // Fetch attested time entries based on filters
    fetchAttestedEntries();
  }, [selectedCustomer, selectedProject, selectedSubproject]);

  const fetchData = async () => {
    const [customersRes, projectsRes, subprojectsRes] = await Promise.all([
      apiFetch(`/customers?order=name`),
      apiFetch(`/projects?order=name`),
      apiFetch(`/subprojects?order=name`),
    ]);

    if (customersRes) setCustomers(customersRes);
    if (projectsRes) setProjects(projectsRes);
    if (subprojectsRes) setSubprojects(subprojectsRes);
  };

  const fetchAttestedEntries = async () => {
    if (selectedCustomer === "all") {
      setAttestedEntries([]);
      return;
    }

    let queryParams: string[] = [];
    queryParams.push("attested=true");
    // Get project IDs for this customer
    const customerProjectIds = projects
      .filter(p => p.customer_id === selectedCustomer)
      .map(p => p.id);

    if (customerProjectIds.length === 0) {
      setAttestedEntries([]);
      return;
    }

    if (selectedProject !== "all") {
      queryParams.push(`project_id=${selectedProject}`);
    } else {
      queryParams.push(`project_ids=${customerProjectIds.join(",")}`);
    }

    if (selectedSubproject !== "all") {
      queryParams.push(`subproject_id=${selectedSubproject}`);
    }

    const q = queryParams.length ? `?${queryParams.join("&")}` : "";
    const data = await apiFetch(`/time-entries${q}`);
    if (data) setAttestedEntries(data);
  };

  const openCustomerDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomerId(customer.id);
      setCustomerName(customer.name);
    } else {
      setEditingCustomerId(null);
      setCustomerName("");
    }
    setShowCustomerDialog(true);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCustomerId) {
        await apiFetch(`/customers/${editingCustomerId}`, { method: "PUT", json: { name: customerName.trim() } });
        toast.success("Kund uppdaterad!");
      } else {
        await apiFetch(`/customers`, { method: "POST", json: { name: customerName.trim(), company_id: companyId } });
        toast.success("Kund skapad!");
      }

      setShowCustomerDialog(false);
      setCustomerName("");
      setEditingCustomerId(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    // Check if customer has projects
    const hasProjects = projects.some(p => p.customer_id === id);
    if (hasProjects) {
      toast.error("Kan inte ta bort kund med kopplade projekt");
      return;
    }

    try {
      await apiFetch(`/customers/${id}`, { method: "DELETE" });
      toast.success("Kund borttagen");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort kund");
    }
  };

  const exportToPDF = async () => {
    if (attestedEntries.length === 0) {
      toast.error("Inga attesterade tidrapporter att exportera");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Get customer and project names
      const customer = customers.find(c => c.id === selectedCustomer);
      const project = selectedProject !== "all" ? projects.find(p => p.id === selectedProject) : null;
      const subproject = selectedSubproject !== "all" ? subprojects.find(sp => sp.id === selectedSubproject) : null;

      // Header
      doc.setFontSize(20);
      doc.text("Attesterade tidrapporter", 14, 20);
      
      doc.setFontSize(12);
      let yPos = 35;
      doc.text(`Kund: ${customer?.name || "-"}`, 14, yPos);
      yPos += 7;
      if (project) {
        doc.text(`Projekt: ${project.name}`, 14, yPos);
        yPos += 7;
      }
      if (subproject) {
        doc.text(`Underprojekt: ${subproject.name}`, 14, yPos);
        yPos += 7;
      }
      doc.text(`Genererad: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 14, yPos);
      yPos += 10;

      // Calculate totals
      let totalHours = 0;
      let totalDay = 0;
      let totalEvening = 0;
      let totalNight = 0;
      let totalWeekend = 0;
      let totalTravel = 0;

      const tableData = attestedEntries.map(entry => {
        totalHours += entry.total_hours;
        totalTravel += entry.travel_time_hours || 0;

        const obDist = calculateOBDistribution(
          entry.date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes
        );
        totalDay += obDist.day;
        totalEvening += obDist.evening;
        totalNight += obDist.night;
        totalWeekend += obDist.weekend;

        return [
          format(new Date(entry.date), "yyyy-MM-dd"),
          entry.profiles?.full_name || "-",
          entry.project?.name || "-",
          entry.subproject?.name || "-",
          `${entry.start_time}-${entry.end_time}`,
          entry.total_hours.toFixed(2),
          entry.travel_time_hours?.toFixed(1) || "0",
          entry.work_description || "-"
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Datum", "Anställd", "Projekt", "Underprojekt", "Tid", "Tim", "Restid", "Beskrivning"]],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 22 },
          5: { cellWidth: 12 },
          6: { cellWidth: 12 },
          7: { cellWidth: 40 }
        },
        margin: { left: 14, right: 14 },
      });

      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text("Sammanfattning", 14, finalY);

      autoTable(doc, {
        startY: finalY + 5,
        head: [["Kategori", "Värde"]],
        body: [
          ["Totalt arbetstid", `${totalHours.toFixed(2)} h`],
          ["Dagtid", `${totalDay.toFixed(2)} h`],
          ["Kvällstid", `${totalEvening.toFixed(2)} h`],
          ["Nattetid", `${totalNight.toFixed(2)} h`],
          ["Helgtid", `${totalWeekend.toFixed(2)} h`],
          ["Restid", `${totalTravel.toFixed(2)} h`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [52, 152, 219], textColor: 255 },
        margin: { left: 14 },
      });

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

      const fileName = `Tidrapporter_${customer?.name || "Kund"}_${project?.name || "Alla"}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName.replace(/\s+/g, "_"));
      toast.success("PDF genererad!");
    } catch (error: any) {
      console.error("PDF error:", error);
      toast.error("Kunde inte generera PDF");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold font-heading">Kunder</h2>
          <p className="text-muted-foreground">Hantera kunder och exportera tidrapporter</p>
        </div>
        <Button onClick={() => openCustomerDialog()} className="bg-gradient-primary">
          <Plus className="mr-2 h-4 w-4" />
          Ny kund
        </Button>
      </div>

      {/* Customer list */}
      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kundlista
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Inga kunder ännu</p>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
                <div key={customer.id} className="flex justify-between items-center border rounded p-3">
                  <span className="font-medium">{customer.name}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openCustomerDialog(customer)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCustomer(customer.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportera tidrapporter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Kund
              </Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Välj kund...</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <FolderKanban className="h-4 w-4" />
                Projekt
              </Label>
              <Select 
                value={selectedProject} 
                onValueChange={setSelectedProject}
                disabled={selectedCustomer === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj projekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla projekt</SelectItem>
                  {filteredProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Layers className="h-4 w-4" />
                Underprojekt
              </Label>
              <Select 
                value={selectedSubproject} 
                onValueChange={setSelectedSubproject}
                disabled={selectedProject === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj underprojekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla underprojekt</SelectItem>
                  {filteredSubprojects.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCustomer !== "all" && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{attestedEntries.length}</strong> attesterade tidrapporter hittade
              </p>
            </div>
          )}

          <Button 
            onClick={exportToPDF} 
            disabled={selectedCustomer === "all" || attestedEntries.length === 0}
            className="w-full bg-gradient-primary"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportera PDF
          </Button>
        </CardContent>
      </Card>

      {/* Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomerId ? "Redigera kund" : "Ny kund"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCustomerSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Kundnamn *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="T.ex. Trafikverket"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {editingCustomerId ? "Uppdatera" : "Skapa"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;