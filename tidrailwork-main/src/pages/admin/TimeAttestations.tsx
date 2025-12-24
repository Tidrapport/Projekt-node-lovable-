import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addWeeks, startOfWeek, getISOWeek, getISOWeekYear, isWithinInterval, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { CheckCircle, Lock, Unlock, Pencil, CheckCircle2, AlertCircle } from "lucide-react";
import { useRef } from "react";

type User = { id: string; full_name?: string; email?: string };
type Project = { id: string; name: string };
type Subproject = { id: string; name: string; project_id: string };
type JobRole = { id: string; name: string };
type Customer = { id: string; name: string };

type TimeEntry = {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  break_minutes: number;
  project_id: string;
  subproject_id: string | null;
  job_role_id: string | null;
  work_description: string;
  status?: string | null;
  attested_by?: string | null;
  attested_at?: string | null;
  invoiced?: boolean;
  project?: { name: string };
  subproject?: { name: string };
  job_role?: { name: string };
  user_email?: string | null;
  user_full_name?: string | null;
  customer_name?: string | null;
};

const statusBadge = (entry: TimeEntry) => {
  if (entry.attested_by) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
        <CheckCircle className="h-3 w-3 mr-1" />
        Attesterad
      </Badge>
    );
  }
  return <Badge variant="outline">{entry.status || "Ny"}</Badge>;
};

export default function TimeAttestations() {
  const { isAdmin, companyId } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedSubproject, setSelectedSubproject] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editSubprojectId, setEditSubprojectId] = useState("");
  const [editJobRoleId, setEditJobRoleId] = useState("");

  useEffect(() => {
    if (!isAdmin || !companyId) return;
    loadLists();
    loadEntries();
  }, [isAdmin, companyId]);

  const loadLists = async () => {
    try {
      const [usersData, projectsData, subprojectsData, jobRolesData, customersData] = await Promise.all([
        apiFetch<User[]>(`/admin/users?company_id=${companyId}`),
        apiFetch<Project[]>(`/projects?active=true`),
        apiFetch<Subproject[]>(`/subprojects?active=true`),
        apiFetch<JobRole[]>(`/job-roles?active=true`),
        apiFetch<Customer[]>(`/customers`),
      ]);
      setUsers(usersData || []);
      setProjects(projectsData || []);
      setSubprojects(subprojectsData || []);
      setJobRoles(jobRolesData || []);
      setCustomers(customersData || []);
    } catch (e: any) {
      toast.error(e.message || "Kunde inte hämta listor");
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const qs = companyId ? `?include_materials=true&company_id=${companyId}` : "?include_materials=true";
      const data = await apiFetch<any[]>(`/time-entries${qs}`);
      const normalized = (data || []).map((e) => ({
        id: String(e.id),
        user_id: String(e.user_id),
        date: e.datum || e.date || "",
        start_time: e.starttid && e.starttid !== "null" ? e.starttid : e.start_time || "",
        end_time: e.sluttid && e.sluttid !== "null" ? e.sluttid : e.end_time || "",
        total_hours: e.timmar != null ? Number(e.timmar) : Number(e.total_hours) || 0,
        break_minutes: e.break_minutes != null ? Number(e.break_minutes) : 0,
        project_id: e.project_id != null ? String(e.project_id) : "",
        subproject_id: e.subproject_id != null ? String(e.subproject_id) : null,
        job_role_id: e.job_role_id != null ? String(e.job_role_id) : null,
        work_description: e.comment || e.work_description || "",
        status: e.status || null,
        attested_by: e.attested_by != null ? String(e.attested_by) : null,
        attested_at: e.attested_at || null,
        project: e.project_name
          ? { name: e.project_name, customer_id: e.customer_id, customer_name: e.customer_name }
          : e.project,
        subproject: e.subproject_name ? { name: e.subproject_name } : e.subproject,
        job_role: e.job_role_name ? { name: e.job_role_name } : e.job_role,
        user_email: e.user_email || null,
        user_full_name: e.user_full_name || e.user_name || null,
        invoiced: e.invoiced ?? false,
        customer_name: e.customer_name || null,
      })) as TimeEntry[];
      setEntries(normalized);
    } catch (e: any) {
      toast.error(e.message || "Kunde inte hämta tidrapporter");
    } finally {
      setLoading(false);
    }
  };

  const filteredSubprojects = useMemo(() => {
    if (selectedProject === "all") return subprojects;
    return subprojects.filter((s) => s.project_id === selectedProject);
  }, [subprojects, selectedProject]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedUser !== "all" && e.user_id !== selectedUser) return false;
      if (selectedStatus === "attested" && !e.attested_by) return false;
      if (selectedStatus === "not_attested" && e.attested_by) return false;
      if (selectedInvoiceStatus === "invoiced" && !e.invoiced) return false;
      if (selectedInvoiceStatus === "not_invoiced" && e.invoiced) return false;
      if (selectedProject !== "all" && e.project_id !== selectedProject) return false;
      if (selectedSubproject !== "all" && e.subproject_id !== selectedSubproject) return false;
      if (selectedCustomer !== "all") {
        const match = e.project && (e.project as any).customer_id
          ? String((e.project as any).customer_id) === selectedCustomer
          : e.customer_name && customers.find((c) => c.id === selectedCustomer)?.name === e.customer_name;
        if (!match) return false;
      }

      const d = e.date ? new Date(e.date) : null;
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      if (selectedWeek !== "all" && d && !Number.isNaN(d.getTime())) {
        const wk = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
        if (wk !== selectedWeek) return false;
      }
      if (d && !Number.isNaN(d.getTime())) {
        if (from && !Number.isNaN(from.getTime()) && d < from) return false;
        if (to && !Number.isNaN(to.getTime()) && d > to) return false;
      }

      return true;
    });
  }, [entries, selectedUser, selectedStatus, selectedProject, selectedSubproject, fromDate, toDate, selectedWeek, selectedCustomer, selectedInvoiceStatus, customers]);

  const attestEntry = async (id: string, approved: boolean) => {
    try {
      await apiFetch(`/time-entries/${id}/attest`, { method: "POST", json: { approved } });
      toast.success(approved ? "Attesterad" : "Låst upp");
      loadEntries();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte uppdatera attest");
    }
  };

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    setEditDescription(entry.work_description || "");
    setEditProjectId(entry.project_id || "");
    setEditSubprojectId(entry.subproject_id || "");
    setEditJobRoleId(entry.job_role_id || "");
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    try {
      await apiFetch(`/time-entries/${editEntry.id}`, {
        method: "PUT",
        json: {
          date: editEntry.date || undefined,
          description: editDescription,
          project_id: editProjectId || null,
          subproject_id: editSubprojectId || null,
          job_role_id: editJobRoleId || null,
        },
      });
      toast.success("Uppdaterad");
      setEditEntry(null);
      loadEntries();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte spara");
    }
  };

  const subprojectsForProject = useMemo(
    () => subprojects.filter((s) => !editProjectId || s.project_id === editProjectId),
    [subprojects, editProjectId]
  );

  const weeksOverview = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(addWeeks(today, -3), { weekStartsOn: 1 });
    const end = addWeeks(start, 4);
    const inRange = entries.filter((e) => {
      const d = e.date ? new Date(e.date) : null;
      return d && isWithinInterval(d, { start, end });
    });

    const grouped = new Map<
      string,
      { label: string; attested: number; total: number; invoiced: number; week: number; year: number }
    >();

    inRange.forEach((e) => {
      const d = e.date ? parseISO(e.date) : new Date(e.date || "");
      const wk = getISOWeek(d);
      const yr = getISOWeekYear(d);
      const key = `${yr}-W${String(wk).padStart(2, "0")}`;
      const label = `Vecka ${wk}`;
      if (!grouped.has(key)) grouped.set(key, { label, attested: 0, total: 0, invoiced: 0, week: wk, year: yr });
      const g = grouped.get(key)!;
      g.total += 1;
      if (e.attested_by) g.attested += 1;
      if (e.invoiced) g.invoiced += 1;
    });

    return Array.from(grouped.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const pendingByWeek = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(addWeeks(today, -3), { weekStartsOn: 1 });
    const end = addWeeks(start, 4);
    const inRange = entries.filter((e) => {
      const d = e.date ? new Date(e.date) : null;
      return d && isWithinInterval(d, { start, end });
    });

    const grouped = new Map<
      string,
      { label: string; users: Map<string, { name: string; count: number }>; week: number; year: number; total: number; attested: number }
    >();

    inRange.forEach((e) => {
      const d = e.date ? new Date(e.date) : null;
      if (!d) return;
      const wk = getISOWeek(d);
      const yr = getISOWeekYear(d);
      const key = `${yr}-W${String(wk).padStart(2, "0")}`;
      const label = `Vecka ${wk}`;
      if (!grouped.has(key)) grouped.set(key, { label, users: new Map(), week: wk, year: yr, total: 0, attested: 0 });
      const g = grouped.get(key)!;
      g.total += 1;
      if (e.attested_by) {
        g.attested += 1;
      } else {
        const name =
          e.user_full_name ||
          users.find((u) => u.id === e.user_id)?.full_name ||
          e.user_email ||
          e.user_id;
        const keyUser = e.user_id;
        const existing = g.users.get(keyUser);
        if (existing) {
          existing.count += 1;
        } else {
          g.users.set(keyUser, { name, count: 1 });
        }
      }
    });

    return Array.from(grouped.entries())
      .filter(([, g]) => g.total > g.attested) // only weeks with pending
      .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries, users]);

  const weekOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      const d = e.date ? new Date(e.date) : null;
      if (d && !Number.isNaN(d.getTime())) {
        const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
        set.add(key);
      }
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [entries]);

  const userLabel = (id: string, fallback?: string | null) => {
    return (
      users.find((u) => u.id === id)?.full_name ||
      fallback ||
      id
    );
  };

  const jumpToUser = (userId: string) => {
    setSelectedUser(userId);
    // Scroll to filter section so admin ser att filtrering aktiverats
    if (filterRef.current) {
      filterRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-3xl font-bold font-heading">Attestering</h2>
          <p className="text-muted-foreground">Granska och attestera tidrapporter för företaget.</p>
        </div>
      </div>

      {/* Klart för fakturering */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Klart för fakturering</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {weeksOverview.slice(0, 4).map(([key, data]) => {
              const ready = data.attested === data.total && data.total > 0;
              const color = ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50";
              return (
                <Card key={key} className={`shadow-card ${color}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {ready ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      {data.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <div>{data.attested}/{data.total} attesterade</div>
                    <div>{data.invoiced}/{data.total} fakturerade</div>
                  </CardContent>
                </Card>
              );
            })}
            {weeksOverview.length === 0 && (
              <Card>
                <CardContent className="py-4 text-sm text-muted-foreground">Inga rapporter senaste veckorna.</CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Oattesterade senaste veckorna */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Oattesterade tidrapporter (senaste 4 veckorna)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingByWeek.length === 0 && (
            <div className="text-sm text-muted-foreground">Alla tidrapporter är attesterade för de senaste veckorna.</div>
          )}
          {pendingByWeek.map(([key, data]) => (
            <Card key={key} className="border border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  {data.label} <Badge variant="outline" className="border-orange-300 text-orange-700">{data.total - data.attested} rapporter</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from(data.users.entries()).map(([userId, info]) => (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="bg-white text-orange-700 border-orange-200 cursor-pointer hover:bg-orange-100"
                    onClick={() => jumpToUser(userId)}
                  >
                    {userLabel(userId, info.name)} · {info.count}
                  </Badge>
                ))}
                {data.users.size === 0 && (
                  <p className="text-sm text-muted-foreground">Inga oattesterade rapporter denna vecka.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6" ref={filterRef}>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Användare" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla användare</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.email || u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedProject}
            onValueChange={(v) => {
              setSelectedProject(v);
              setSelectedSubproject("all");
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Projekt" />
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

          <Select value={selectedSubproject} onValueChange={setSelectedSubproject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Underprojekt" />
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

          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Kund" />
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

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="attested">Attesterade</SelectItem>
              <SelectItem value="not_attested">Ej attesterade</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedInvoiceStatus} onValueChange={setSelectedInvoiceStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Fakturering" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="invoiced">Fakturerade</SelectItem>
              <SelectItem value="not_invoiced">Ej fakturerade</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vecka" />
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

          <div className="flex items-center gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[150px]" />
            <span className="text-sm text-muted-foreground">–</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[150px]" />
          </div>

          <Button variant="outline" onClick={loadEntries} disabled={loading}>
            Uppdatera
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredEntries.length === 0 && (
          <Card>
            <CardContent className="py-6 text-muted-foreground text-sm">Inga tidrapporter att visa.</CardContent>
          </Card>
        )}

        {filteredEntries.map((entry) => (
          <Card key={entry.id} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {statusBadge(entry)}
                  <span>
                    {(() => {
                      const d = entry.date ? new Date(entry.date) : null;
                      if (d && !Number.isNaN(d.getTime())) {
                        return `${format(d, "EEEE d MMMM yyyy", { locale: sv })} – ${entry.total_hours.toFixed(2)} h`;
                      }
                      return `${entry.date || "Okänt datum"} – ${entry.total_hours.toFixed(2)} h`;
                    })()}
                  </span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {(entry.start_time || "–")} – {(entry.end_time || "–")} · {entry.project?.name || "Projekt saknas"}
                  {entry.subproject?.name ? ` · ${entry.subproject.name}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {entry.user_full_name || entry.user_email || entry.user_id} · {entry.job_role?.name || "Roll saknas"}
                </p>
              </div>
              <div className="flex gap-2">
                {entry.attested_by ? (
                  <Button size="sm" variant="outline" onClick={() => attestEntry(entry.id, false)}>
                    <Unlock className="h-4 w-4 mr-1" /> Lås upp
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => attestEntry(entry.id, true)}>
                    <Lock className="h-4 w-4 mr-1" /> Attestera
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>
                  <Pencil className="h-4 w-4 mr-1" /> Redigera
                </Button>
              </div>
            </CardHeader>
            {entry.work_description && (
              <CardContent className="text-sm text-muted-foreground pt-0">{entry.work_description}</CardContent>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Redigera tidrapport</DialogTitle>
            <DialogDescription>Uppdatera projekt, roll och beskrivning.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={editProjectId} onValueChange={(v) => { setEditProjectId(v); setEditSubprojectId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Projekt" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={editSubprojectId} onValueChange={setEditSubprojectId} disabled={!editProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Underprojekt" />
              </SelectTrigger>
              <SelectContent>
                {subprojectsForProject.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={editJobRoleId} onValueChange={setEditJobRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Yrkesroll" />
              </SelectTrigger>
              <SelectContent>
                {jobRoles.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Arbetsbeskrivning</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditEntry(null)}>
                Avbryt
              </Button>
              <Button onClick={saveEdit}>Spara</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
