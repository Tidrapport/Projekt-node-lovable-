import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, Download, Plus, Edit, Trash2, FolderKanban, Layers } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateOBDistributionWithOvertime } from "@/lib/obDistribution";

interface Customer {
  id: string;
  name: string;
  customer_number?: string | null;
  customer_type?: string | null;
  orgnr?: string | null;
  vat_number?: string | null;
  reverse_vat?: boolean | number | null;
  invoice_address1?: string | null;
  invoice_address2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  contact_phone?: string | null;
  phone_secondary?: string | null;
  invoice_email?: string | null;
  payment_terms?: string | null;
  contact_email?: string | null;
  their_reference?: string | null;
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

const toDigits = (value: string) => value.replace(/\D/g, "");

const formatVatNumber = (value: string) => {
  const digits = toDigits(value || "");
  if (!digits) return "";
  let base = digits;
  if (digits.length >= 12 && digits.endsWith("01")) {
    base = digits.slice(0, -2);
  } else if (digits.length > 10) {
    base = digits.slice(0, 10);
  }
  return `SE${base}01`;
};

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
  const [customerForm, setCustomerForm] = useState({
    name: "",
    customer_number: "",
    customer_type: "company",
    orgnr: "",
    vat_number: "",
    invoice_address1: "",
    invoice_address2: "",
    postal_code: "",
    city: "",
    country: "",
    contact_phone: "",
    phone_secondary: "",
    contact_email: "",
    invoice_email: "",
    payment_terms: "30 dagar",
    their_reference: "",
    reverse_vat: false,
  });

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

    setCustomers(ensureArray(customersRes));
    setProjects(ensureArray(projectsRes).map((p: any) => ({
      ...p,
      id: String(p.id),
      customer_id: p.customer_id != null ? String(p.customer_id) : null,
    })));
    setSubprojects(ensureArray(subprojectsRes).map((s: any) => ({
      ...s,
      id: String(s.id),
      project_id: String(s.project_id),
    })));
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
      setCustomerForm({
        name: customer.name || "",
        customer_number: customer.customer_number || "",
        customer_type: customer.customer_type || "company",
        orgnr: customer.orgnr || "",
        vat_number: formatVatNumber(customer.vat_number || customer.orgnr || ""),
        invoice_address1: customer.invoice_address1 || "",
        invoice_address2: customer.invoice_address2 || "",
        postal_code: customer.postal_code || "",
        city: customer.city || "",
        country: customer.country || "",
        contact_phone: customer.contact_phone || "",
        phone_secondary: customer.phone_secondary || "",
        contact_email: customer.contact_email || "",
        invoice_email: customer.invoice_email || "",
        payment_terms: customer.payment_terms || "30 dagar",
        their_reference: customer.their_reference || "",
        reverse_vat: Boolean(customer.reverse_vat),
      });
    } else {
      setEditingCustomerId(null);
      setCustomerForm({
        name: "",
        customer_number: "",
        customer_type: "company",
        orgnr: "",
        vat_number: "",
        invoice_address1: "",
        invoice_address2: "",
        postal_code: "",
        city: "",
        country: "",
        contact_phone: "",
        phone_secondary: "",
        contact_email: "",
        invoice_email: "",
        payment_terms: "30 dagar",
        their_reference: "",
        reverse_vat: false,
      });
    }
    setShowCustomerDialog(true);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const name = customerForm.name.trim();
      const customerNumber = customerForm.customer_number.trim();
      if (!name || !customerNumber) {
        toast.error("Kundnamn och kundnummer krävs.");
        setLoading(false);
        return;
      }
      const payload = {
        name,
        customer_number: customerNumber,
        customer_type: customerForm.customer_type || "company",
        orgnr: customerForm.orgnr.trim() || null,
        vat_number: formatVatNumber(customerForm.vat_number || customerForm.orgnr) || null,
        invoice_address1: customerForm.invoice_address1.trim() || null,
        invoice_address2: customerForm.invoice_address2.trim() || null,
        postal_code: customerForm.postal_code.trim() || null,
        city: customerForm.city.trim() || null,
        country: customerForm.country.trim() || null,
        contact_phone: customerForm.contact_phone.trim() || null,
        phone_secondary: customerForm.phone_secondary.trim() || null,
        contact_email: customerForm.contact_email.trim() || null,
        invoice_email: customerForm.invoice_email.trim() || null,
        payment_terms: customerForm.payment_terms.trim() || null,
        their_reference: customerForm.their_reference.trim() || null,
        reverse_vat: customerForm.reverse_vat ? 1 : 0,
        company_id: companyId,
      };
      if (editingCustomerId) {
        await apiFetch(`/customers/${editingCustomerId}`, { method: "PUT", json: payload });
        toast.success("Kund uppdaterad!");
      } else {
        await apiFetch(`/customers`, { method: "POST", json: payload });
        toast.success("Kund skapad!");
      }

      setShowCustomerDialog(false);
      setCustomerForm({
        name: "",
        customer_number: "",
        customer_type: "company",
        orgnr: "",
        vat_number: "",
        invoice_address1: "",
        invoice_address2: "",
        postal_code: "",
        city: "",
        country: "",
        contact_phone: "",
        phone_secondary: "",
        contact_email: "",
        invoice_email: "",
        payment_terms: "30 dagar",
        their_reference: "",
        reverse_vat: false,
      });
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

        const obDist = calculateOBDistributionWithOvertime(
          entry.date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes,
          entry.overtime_weekday_hours,
          entry.overtime_weekend_hours
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kundnummer *</Label>
                <Input
                  value={customerForm.customer_number}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, customer_number: e.target.value }))}
                  placeholder="20331"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Kundtyp</Label>
                <Select
                  value={customerForm.customer_type}
                  onValueChange={(value) => setCustomerForm((prev) => ({ ...prev, customer_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj typ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Företag</SelectItem>
                    <SelectItem value="private">Privat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Kundnamn *</Label>
                <Input
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="T.ex. Trafikverket"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Org-/Personnummer</Label>
                <Input
                  value={customerForm.orgnr}
                  onChange={(e) => {
                    const orgNumber = e.target.value;
                    const autoVat = formatVatNumber(orgNumber);
                    setCustomerForm((prev) => ({
                      ...prev,
                      orgnr: orgNumber,
                      vat_number: autoVat,
                    }));
                  }}
                  placeholder="556000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>VAT-nummer</Label>
                <Input
                  value={customerForm.vat_number}
                  onChange={(e) => {
                    const formatted = formatVatNumber(e.target.value);
                    setCustomerForm((prev) => ({ ...prev, vat_number: formatted }));
                  }}
                  placeholder="SE556000000001"
                />
              </div>
              <div className="space-y-2">
                <Label>Betalningsvillkor</Label>
                <Input
                  value={customerForm.payment_terms}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, payment_terms: e.target.value }))}
                  placeholder="30 dagar"
                />
              </div>
              <div className="flex items-center gap-2 pt-2 md:col-span-2">
                <Checkbox
                  id="reverseVat"
                  checked={customerForm.reverse_vat}
                  onCheckedChange={(value) =>
                    setCustomerForm((prev) => ({ ...prev, reverse_vat: value === true }))
                  }
                />
                <Label htmlFor="reverseVat">Omvänd byggmoms</Label>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Fakturaadress</Label>
                <Input
                  value={customerForm.invoice_address1}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, invoice_address1: e.target.value }))}
                  placeholder="Gatuadress"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Fakturaadress 2</Label>
                <Input
                  value={customerForm.invoice_address2}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, invoice_address2: e.target.value }))}
                  placeholder="C/O, våning, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Postnr</Label>
                <Input
                  value={customerForm.postal_code}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="123 45"
                />
              </div>
              <div className="space-y-2">
                <Label>Ort</Label>
                <Input
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Stad"
                />
              </div>
              <div className="space-y-2">
                <Label>Land</Label>
                <Input
                  value={customerForm.country}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="Sverige"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={customerForm.contact_phone}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="070..."
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon 2</Label>
                <Input
                  value={customerForm.phone_secondary}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone_secondary: e.target.value }))}
                  placeholder="08..."
                />
              </div>
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input
                  value={customerForm.contact_email}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                  placeholder="kund@foretag.se"
                />
              </div>
              <div className="space-y-2">
                <Label>Faktura-e-post</Label>
                <Input
                  value={customerForm.invoice_email}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, invoice_email: e.target.value }))}
                  placeholder="faktura@foretag.se"
                />
              </div>
              <div className="space-y-2">
                <Label>Er referens</Label>
                <Input
                  value={customerForm.their_reference}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, their_reference: e.target.value }))}
                  placeholder="Kontaktperson"
                />
              </div>
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
