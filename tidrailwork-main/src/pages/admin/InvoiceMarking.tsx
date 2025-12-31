import { useEffect, useMemo, useState } from "react";
import { format, getISOWeek, getISOWeekYear } from "date-fns";
import { sv } from "date-fns/locale";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type TimeEntry = {
  id: string;
  date: string;
  total_hours: number;
  travel_time_hours: number;
  attested_by: string | null;
  project_id: string | null;
  user_id: string;
  project_name?: string | null;
  customer_name?: string | null;
  user_full_name?: string | null;
  invoiced?: boolean;
};

type Customer = { id: string; name: string };
type Project = { id: string; name: string; customer_id?: string | null; customer_name?: string | null };
type UserProfile = { id: string; full_name?: string | null; email?: string | null };

const InvoiceMarking = () => {
  const { companyId } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const [customerId, setCustomerId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [userId, setUserId] = useState("all");
  const [invoiceStatus, setInvoiceStatus] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    void fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [entryData, customerData, projectData, userData] = await Promise.all([
        apiFetch<any[]>("/time-entries"),
        apiFetch<Customer[]>("/customers"),
        apiFetch<Project[]>("/projects?active=true"),
        apiFetch<UserProfile[]>("/admin/users"),
      ]);

      const normalized = ensureArray(entryData).map((e) => ({
        id: String(e.id),
        date: e.datum || e.date || "",
        total_hours: e.timmar != null ? Number(e.timmar) : Number(e.total_hours) || 0,
        travel_time_hours: e.restid != null ? Number(e.restid) : Number(e.travel_time_hours) || 0,
        attested_by: e.attested_by != null ? String(e.attested_by) : null,
        project_id: e.project_id != null ? String(e.project_id) : null,
        user_id: e.user_id != null ? String(e.user_id) : "",
        project_name: e.project_name || null,
        customer_name: e.customer_name || null,
        user_full_name: e.user_full_name || e.user_name || null,
        invoiced: Boolean(Number(e.invoiced)),
      })) as TimeEntry[];

      setEntries(normalized);
      setCustomers(ensureArray(customerData));
      setProjects(ensureArray(projectData));
      setUsers(ensureArray(userData));
      setSelectedEntries(new Set());
    } catch (error: any) {
      toast.error(error?.message || "Kunde inte ladda tidrapporter.");
    }
  };

  const preWeekEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (customerId !== "all") {
        const project = projects.find((p) => String(p.id) === String(entry.project_id || ""));
        const matchesCustomer =
          project?.customer_id === customerId ||
          (project?.customer_name && project.customer_name === customers.find((c) => c.id === customerId)?.name) ||
          (entry.customer_name && entry.customer_name === customers.find((c) => c.id === customerId)?.name);
        if (!matchesCustomer) return false;
      }
      if (projectId !== "all" && String(entry.project_id || "") !== projectId) return false;
      if (userId !== "all" && String(entry.user_id || "") !== userId) return false;
      if (invoiceStatus === "invoiced" && !entry.invoiced) return false;
      if (invoiceStatus === "not_invoiced" && entry.invoiced) return false;

      const d = entry.date ? new Date(entry.date) : null;
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      if (d && !Number.isNaN(d.getTime())) {
        if (from && !Number.isNaN(from.getTime()) && d < from) return false;
        if (to && !Number.isNaN(to.getTime()) && d > to) return false;
      }
      return true;
    });
  }, [entries, customers, projects, customerId, projectId, userId, invoiceStatus, fromDate, toDate]);

  const weekOptions = useMemo(() => {
    const set = new Set<string>();
    preWeekEntries.forEach((entry) => {
      const d = entry.date ? new Date(entry.date) : null;
      if (d && !Number.isNaN(d.getTime())) {
        const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
        set.add(key);
      }
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [preWeekEntries]);

  const filteredEntries = useMemo(() => {
    return preWeekEntries.filter((entry) => {
      if (selectedWeek === "all") return true;
      const d = entry.date ? new Date(entry.date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
      return key === selectedWeek;
    });
  }, [preWeekEntries, selectedWeek]);

  useEffect(() => {
    setSelectedEntries((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(filteredEntries.map((entry) => entry.id));
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      return next;
    });
  }, [filteredEntries]);

  const selectedCount = selectedEntries.size;

  const updateInvoiced = async (flag: boolean) => {
    if (!selectedCount) {
      toast.error("Välj minst en rad att uppdatera.");
      return;
    }
    try {
      const ids = Array.from(selectedEntries);
      await apiFetch("/admin/time-entries/mark-invoiced", {
        method: "POST",
        json: { ids, invoiced: flag, company_id: companyId },
      });
      setEntries((prev) =>
        prev.map((entry) => (ids.includes(entry.id) ? { ...entry, invoiced: flag } : entry))
      );
      setSelectedEntries(new Set());
      toast.success(flag ? "Markerat som fakturerade." : "Avmarkerat fakturerade.");
    } catch (error: any) {
      toast.error(error?.message || "Kunde inte uppdatera faktureringsstatus.");
    }
  };

  const getUserName = (entry: TimeEntry) =>
    entry.user_full_name || users.find((u) => u.id === entry.user_id)?.full_name || entry.user_id;
  const getProjectName = (entry: TimeEntry) =>
    entry.project_name || projects.find((p) => p.id === entry.project_id)?.name || "–";
  const getCustomerName = (entry: TimeEntry) => {
    if (entry.customer_name) return entry.customer_name;
    const project = projects.find((p) => p.id === entry.project_id);
    if (project?.customer_name) return project.customer_name;
    const customer = customers.find((c) => c.id === project?.customer_id);
    return customer?.name || "–";
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fakturering – markera</h1>
          <p className="text-sm text-muted-foreground">
            Markera tidrapporter som fakturerade eller ta bort markeringen manuellt.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => updateInvoiced(true)} disabled={!selectedCount}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Markera fakturerad
          </Button>
          <Button variant="outline" onClick={() => updateInvoiced(false)} disabled={!selectedCount}>
            <XCircle className="mr-2 h-4 w-4" />
            Avmarkera
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Filtrera tidrapporter innan du markerar fakturerade.</CardDescription>
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
            <Select value={projectId} onValueChange={setProjectId}>
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
            <Label>Användare</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla användare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla användare</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || u.email || u.id}
                  </SelectItem>
                ))}
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
            <Label>Vecka</Label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Alla veckor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla veckor</SelectItem>
                {weekOptions.map((wk) => (
                  <SelectItem key={wk} value={wk}>
                    {`Vecka ${wk.split("W")[1]}, ${wk.split("-")[0]}`}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Underlag</CardTitle>
          <CardDescription>{filteredEntries.length} rader i urvalet.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen data matchar filtren.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={filteredEntries.length > 0 && selectedEntries.size === filteredEntries.length}
                      onChange={(ev) => {
                        if (ev.currentTarget.checked) {
                          setSelectedEntries(new Set(filteredEntries.map((e) => e.id)));
                        } else {
                          setSelectedEntries(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Användare</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead className="text-right">Timmar</TableHead>
                  <TableHead className="text-right">Restid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.id)}
                        onChange={(ev) => {
                          setSelectedEntries((prev) => {
                            const next = new Set(prev);
                            if (ev.currentTarget.checked) next.add(entry.id);
                            else next.delete(entry.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>{entry.date ? format(new Date(entry.date), "yyyy-MM-dd", { locale: sv }) : "–"}</TableCell>
                    <TableCell>{getUserName(entry)}</TableCell>
                    <TableCell>{getCustomerName(entry)}</TableCell>
                    <TableCell>{getProjectName(entry)}</TableCell>
                    <TableCell className="text-right">{entry.total_hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{entry.travel_time_hours.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.invoiced ? "default" : "outline"}>
                        {entry.invoiced ? "Fakturerad" : "Ej fakturerad"}
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

export default InvoiceMarking;
