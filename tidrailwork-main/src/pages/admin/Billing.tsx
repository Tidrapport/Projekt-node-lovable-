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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    void fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [{ data: entryData, error: entryError }, { data: customerData }, { data: projectData }, { data: subprojectData }, { data: userData }] =
        await Promise.all([
          supabase
            .from("time_entries")
            .select(
              `
                *,
                project:projects(id, name, customer_id, customer_name),
                subproject:subprojects(id, name, project_id),
                profiles:profiles!time_entries_user_id_fkey(id, full_name)
              `
            )
            .order("date", { ascending: false }),
          supabase.from("customers").select("id, name").order("name"),
          supabase.from("projects").select("id, name, customer_id, customer_name").order("name"),
          supabase.from("subprojects").select("id, name, project_id").order("name"),
          supabase.from("profiles").select("id, full_name").order("full_name"),
        ]);

      if (entryError) throw entryError;

      setEntries(entryData || []);
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
    return subprojects.filter((s) => s.project_id === projectId);
  }, [projectId, subprojects]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (customerId !== "all") {
        const proj = entry.project;
        const matchesCustomer =
          proj &&
          (proj.customer_id === customerId ||
            (proj.customer_name && proj.customer_name === customers.find((c) => c.id === customerId)?.name));
        if (!matchesCustomer) return false;
      }
      if (projectId !== "all" && entry.project_id !== projectId) return false;
      if (subprojectId !== "all" && entry.subproject_id !== subprojectId) return false;
      if (userId !== "all" && entry.user_id !== userId) return false;

      if (fromDate && new Date(entry.date) < new Date(fromDate)) return false;
      if (toDate && new Date(entry.date) > new Date(toDate)) return false;

      return true;
    });
  }, [entries, customerId, projectId, subprojectId, userId, fromDate, toDate, customers]);

  const totals = useMemo(() => {
    const hours = filteredEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const travel = filteredEntries.reduce((sum, e) => sum + (e.travel_time_hours || 0), 0);
    const attested = filteredEntries.filter((e) => e.attested_by).length;
    return { hours, travel, attested, count: filteredEntries.length };
  }, [filteredEntries]);

  const getProjectName = (entry: TimeEntry) => entry.project?.name || "–";
  const getSubprojectName = (entry: TimeEntry) => entry.subproject?.name || "–";
  const getCustomerName = (entry: TimeEntry) => {
    if (entry.project?.customer_name) return entry.project.customer_name;
    const projCustomer = customers.find((c) => c.id === entry.project?.customer_id);
    return projCustomer?.name || "–";
  };
  const getUserName = (entry: TimeEntry) => entry.profiles?.full_name || "–";

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
        format(new Date(e.date), "yyyy-MM-dd"),
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
                  <SelectItem key={c.id} value={c.id}>
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
                  <SelectItem key={p.id} value={p.id}>
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
                  <SelectItem key={s.id} value={s.id}>
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
                  <SelectItem key={u.id} value={u.id}>
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
            <Label className="sr-only">Reset</Label>
            <Button variant="outline" className="w-full" onClick={() => {
              setCustomerId("all");
              setProjectId("all");
              setSubprojectId("all");
              setUserId("all");
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
