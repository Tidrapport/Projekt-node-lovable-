import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";

interface TimeEntry {
  id: string;
  date: string;
  total_hours: number;
  travel_time_hours?: number | null;
  attested_by: string | null;
  project_id: string | null;
  subproject_id: string | null;
  user_id: string;
  project?: { id: string; name: string; customer_id?: string | null; customer_name?: string | null };
  subproject?: { id: string; name: string | null };
  profiles?: { id: string; full_name: string | null };
}

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  customer_id?: string | null;
  customer_name?: string | null;
}

interface Subproject {
  id: string;
  name: string;
  project_id: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
}

const Billing = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [customerId, setCustomerId] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("all");
  const [subprojectId, setSubprojectId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [invoiceStatus, setInvoiceStatus] = useState<string>("all");
  const [attestStatus, setAttestStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    void fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [entryData, customerData, projectData, subprojectData, userData] = await Promise.all([
        apiFetch<any[]>("/time-entries?include_materials=true"),
        apiFetch<Customer[]>("/customers"),
        apiFetch<Project[]>("/projects?active=true"),
        apiFetch<Subproject[]>("/subprojects?active=true"),
        apiFetch<UserProfile[]>("/admin/users"),
      ]);

      const normalized = (entryData || []).map((e) => ({
        id: String(e.id),
        date: e.datum || e.date || "",
        total_hours: e.timmar != null ? Number(e.timmar) : Number(e.total_hours) || 0,
        travel_time_hours: e.restid != null ? Number(e.restid) : Number(e.travel_time_hours) || 0,
        attested_by: e.attested_by != null ? String(e.attested_by) : null,
        invoiced: e.invoiced ?? false,
        project_id: e.project_id != null ? String(e.project_id) : null,
        subproject_id: e.subproject_id != null ? String(e.subproject_id) : null,
        user_id: e.user_id != null ? String(e.user_id) : "",
        project:
          e.project_name || e.customer_name
            ? {
                id: String(e.project_id || ""),
                name: e.project_name || "",
                customer_id: e.customer_id != null ? String(e.customer_id) : null,
                customer_name: e.customer_name
              }
            : e.project,
        subproject: e.subproject_name ? { id: String(e.subproject_id || ""), name: e.subproject_name, project_id: e.project_id } : e.subproject,
        profiles: e.user_full_name ? { id: String(e.user_id || ""), full_name: e.user_full_name } : e.profiles,
      })) as TimeEntry[];

      setEntries(normalized);
      setCustomers(customerData || []);
      setProjects(projectData || []);
      setSubprojects(subprojectData || []);
      setUsers(userData || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Kunde inte ladda faktureringsunderlag.");
    }
  };

  const filteredSubprojects = useMemo(() => {
    if (projectId === "all") return subprojects;
    return subprojects.filter((s) => String(s.project_id) === projectId);
  }, [projectId, subprojects]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (customerId !== "all") {
        const proj = entry.project;
        const matchesCustomer =
          proj &&
          (String(proj.customer_id || "") === customerId ||
            (proj.customer_name && proj.customer_name === customers.find((c) => String(c.id) === customerId)?.name));
        if (!matchesCustomer) return false;
      }
      if (projectId !== "all" && String(entry.project_id || "") !== projectId) return false;
      if (subprojectId !== "all" && String(entry.subproject_id || "") !== subprojectId) return false;
      if (userId !== "all" && String(entry.user_id || "") !== userId) return false;
      if (attestStatus === "attested" && !entry.attested_by) return false;
      if (attestStatus === "not_attested" && entry.attested_by) return false;
      if (invoiceStatus === "invoiced" && !(entry as any).invoiced) return false;
      if (invoiceStatus === "not_invoiced" && (entry as any).invoiced) return false;

      const d = entry.date ? new Date(entry.date) : null;
      const fromD = fromDate ? new Date(fromDate) : null;
      const toD = toDate ? new Date(toDate) : null;
      if (d && !Number.isNaN(d.getTime())) {
        if (fromD && !Number.isNaN(fromD.getTime()) && d < fromD) return false;
        if (toD && !Number.isNaN(toD.getTime()) && d > toD) return false;
      }

      return true;
    });
  }, [entries, customerId, projectId, subprojectId, userId, fromDate, toDate, customers, attestStatus, invoiceStatus]);

  const totals = useMemo(() => {
    const hours = filteredEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const travel = filteredEntries.reduce((sum, e) => sum + (e.travel_time_hours || 0), 0);
    const attested = filteredEntries.filter((e) => e.attested_by).length;
    return { hours, travel, attested, count: filteredEntries.length };
  }, [filteredEntries]);

  const getProjectName = (entry: TimeEntry) => entry.project?.name || (entry as any).project_name || "–";
  const getSubprojectName = (entry: TimeEntry) => entry.subproject?.name || (entry as any).subproject_name || "–";
  const getCustomerName = (entry: TimeEntry) => {
    if (entry.project?.customer_name) return entry.project.customer_name;
    const projCustomer = customers.find(
      (c) => String(c.id) === String(entry.project?.customer_id || (entry as any).customer_id || "")
    );
    return projCustomer?.name || "–";
  };
  const getUserName = (entry: TimeEntry) => entry.profiles?.full_name || (entry as any).user_full_name || "–";
  const safeFormatDate = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : null;
    if (d && !Number.isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
    return dateStr || "";
  };

  const exportCSV = () => {
    if (!filteredEntries.length) {
      toast.error("Inget att exportera.");
      return;
    }
    const header = ["Datum", "Användare", "Kund", "Projekt", "Underprojekt", "Timmar", "Restid", "Status"];
    const rows = filteredEntries.map((e) => [
      e.date,
      getUserName(e),
      getCustomerName(e),
      getProjectName(e),
      getSubprojectName(e),
      e.total_hours?.toFixed(2) ?? "0",
      (e.travel_time_hours ?? 0).toFixed(2),
      e.attested_by ? "Attesterad" : "Ej attesterad",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fakturering_fortnox.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fortnox-fil genererad.");
  };

  const exportPDF = () => {
    if (!filteredEntries.length) {
      toast.error("Inget att exportera.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Fakturaunderlag", 14, 18);
    doc.setFontSize(11);
    const periodLine =
      fromDate || toDate
        ? `Period: ${fromDate || "..."} - ${toDate || "..."}`
        : "Period: Alla datum";
    doc.text(periodLine, 14, 26);

    autoTable(doc, {
      startY: 34,
      head: [["Datum", "Användare", "Kund", "Projekt", "Underprojekt", "Timmar", "Restid", "Status"]],
      body: filteredEntries.map((e) => [
        safeFormatDate(e.date),
        getUserName(e),
        getCustomerName(e),
        getProjectName(e),
        getSubprojectName(e),
        e.total_hours?.toFixed(2) ?? "0",
        (e.travel_time_hours ?? 0).toFixed(2),
        e.attested_by ? "Attesterad" : "Ej attesterad",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [6, 99, 197] },
    });

    doc.text(`Rader: ${totals.count}`, 14, doc.lastAutoTable.finalY + 10);
    doc.text(`Totalt timmar: ${totals.hours.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 16);
    doc.text(`Restid: ${totals.travel.toFixed(2)} h`, 14, doc.lastAutoTable.finalY + 22);
    doc.text(`Attesterade: ${totals.attested}`, 14, doc.lastAutoTable.finalY + 28);

    doc.save("fakturering.pdf");
    toast.success("PDF skapad.");
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Fakturering</h1>
          <p className="text-sm text-muted-foreground">
            Filtrera tidrapporter per kund, projekt och användare. Exportera till PDF eller Fortnox.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Fortnox-fil
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Välj kund, projekt, underprojekt, användare och datumintervall.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Kund</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla kunder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kunder</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Projekt</Label>
            <Select value={projectId} onValueChange={(val) => { setProjectId(val); setSubprojectId("all"); }}>
              <SelectTrigger>
                <SelectValue placeholder="Alla projekt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla projekt</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Underprojekt</Label>
            <Select value={subprojectId} onValueChange={setSubprojectId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla underprojekt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla underprojekt</SelectItem>
                {filteredSubprojects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Användare</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla användare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla användare</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || "Användare"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Från datum</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Till datum</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Atteststatus</Label>
            <Select value={attestStatus} onValueChange={setAttestStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="attested">Attesterade</SelectItem>
                <SelectItem value="not_attested">Ej attesterade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fakturering</Label>
            <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="invoiced">Fakturerade</SelectItem>
                <SelectItem value="not_invoiced">Ej fakturerade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="sr-only">Reset</Label>
            <Button variant="outline" className="w-full" onClick={() => {
              setCustomerId("all");
              setProjectId("all");
              setSubprojectId("all");
              setUserId("all");
              setInvoiceStatus("all");
              setAttestStatus("all");
              setFromDate("");
              setToDate("");
            }}>
              Rensa filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Översikt</CardTitle>
          <CardDescription>Summering för aktuell filtrering.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Rader</p>
            <p className="text-xl font-bold">{totals.count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Totalt timmar</p>
            <p className="text-xl font-bold">{totals.hours.toFixed(2)} h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Restid</p>
            <p className="text-xl font-bold">{totals.travel.toFixed(2)} h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Attesterade</p>
            <p className="text-xl font-bold">{totals.attested}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Underlag</CardTitle>
          <CardDescription>Matchande tidrapporter för vald filtrering.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen data matchar filtren.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Användare</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Underprojekt</TableHead>
                  <TableHead className="text-right">Timmar</TableHead>
                  <TableHead className="text-right">Restid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.date), "yyyy-MM-dd", { locale: sv })}</TableCell>
                    <TableCell>{getUserName(entry)}</TableCell>
                    <TableCell>{getCustomerName(entry)}</TableCell>
                    <TableCell>{getProjectName(entry)}</TableCell>
                    <TableCell>{getSubprojectName(entry)}</TableCell>
                    <TableCell className="text-right">{(entry.total_hours || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{(entry.travel_time_hours || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.attested_by ? "default" : "secondary"}>
                        {entry.attested_by ? "Attesterad" : "Ej attesterad"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
