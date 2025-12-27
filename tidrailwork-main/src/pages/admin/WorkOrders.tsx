import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiFetch, getToken } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ChevronDown, Download, Filter, Plus, Search } from "lucide-react";

type WorkOrderAssignee = {
  id: number;
  full_name: string;
  email: string;
};

type WorkOrder = {
  id: number;
  order_number: number;
  order_year: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  priority?: string | null;
  deadline?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  status?: string | null;
  assignees?: WorkOrderAssignee[];
  report_text?: string | null;
  report_updated_at?: string | null;
  closed_at?: string | null;
  closed_by_name?: string | null;
  attested_at?: string | null;
  attested_by_name?: string | null;
  created_at?: string | null;
};

type ProjectOption = { id: number; name: string };
type UserOption = { id: number; full_name?: string; email?: string };

const WorkOrders = () => {
  const { companyId, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [attesting, setAttesting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const normalizeStatus = (status?: string | null) => {
    const value = String(status || "not_started").toLowerCase();
    if (value === "active") return "not_started";
    return value;
  };

  useEffect(() => {
    fetchData();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsData, usersData, ordersData] = await Promise.all([
        apiFetch<ProjectOption[]>(`/projects?active=true`),
        apiFetch<UserOption[]>(`/admin/users${companyId ? `?company_id=${companyId}` : ""}`),
        apiFetch<WorkOrder[]>(`/work-orders${companyId && !isSuperAdmin ? "" : companyId ? `?company_id=${companyId}` : ""}`),
      ]);
      setProjects(projectsData || []);
      setUsers(usersData || []);
      setWorkOrders(ordersData || []);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta arbetsorder");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setInstructions("");
    setProjectId("");
    setPriority("medium");
    setDeadline("");
    setAddress("");
    setContactName("");
    setContactPhone("");
    setSelectedAssignees([]);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Titel krävs");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/work-orders", {
        method: "POST",
        json: {
          title: title.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          project_id: projectId ? Number(projectId) : null,
          priority,
          deadline: deadline || null,
          address: address.trim() || null,
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          assignees: selectedAssignees,
          company_id: companyId || null,
        },
      });
      toast.success("Arbetsorder skapad");
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte skapa arbetsorder");
    } finally {
      setSaving(false);
    }
  };

  const handleAttest = async (order: WorkOrder) => {
    if (!order || attesting) return;
    setAttesting(true);
    try {
      await apiFetch(`/work-orders/${order.id}/attest`, { method: "POST" });
      toast.success("Arbetsorder attesterad");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte attestera");
    } finally {
      setAttesting(false);
    }
  };

  const handleDownloadPdf = async (order: WorkOrder) => {
    if (!order || downloadingId) return;
    setDownloadingId(order.id);
    try {
      const token = getToken();
      const base = import.meta.env.VITE_API_BASE_URL?.trim() || "";
      const query = isSuperAdmin && companyId ? `?company_id=${companyId}` : "";
      const url = base ? `${base}/work-orders/${order.id}/pdf${query}` : `/work-orders/${order.id}/pdf${query}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Kunde inte hämta arbetsorder");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const orderCode = `${order.order_year}-${String(order.order_number).padStart(4, "0")}`;
      a.href = downloadUrl;
      a.download = `arbetsorder_${orderCode}.pdf`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte ladda ner arbetsorder");
    } finally {
      setDownloadingId(null);
    }
  };

  const isOverdue = (order: WorkOrder) => {
    if (!order.deadline) return false;
    const status = normalizeStatus(order.status);
    if (status === "closed" || status === "attested") return false;
    const deadlineDate = new Date(order.deadline);
    if (Number.isNaN(deadlineDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  const activeOrders = workOrders.filter(
    (order) => {
      const status = normalizeStatus(order.status);
      return status !== "closed" && status !== "attested" && !isOverdue(order);
    }
  );
  const closedOrders = workOrders.filter(
    (order) => {
      const status = normalizeStatus(order.status);
      return status === "closed" || status === "attested";
    }
  );
  const overdueOrders = workOrders.filter((order) => isOverdue(order));
  const totalCount = workOrders.length;
  const activeCount = activeOrders.length;
  const closedCount = closedOrders.length;
  const overdueCount = overdueOrders.length;

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return workOrders
      .filter((order) => {
        if (!term) return true;
        const assigneeNames = (order.assignees || [])
          .map((a) => a.full_name || a.email || "")
          .join(" ")
          .toLowerCase();
        const orderCode = `${order.order_year}-${String(order.order_number).padStart(3, "0")}`.toLowerCase();
        return (
          order.title.toLowerCase().includes(term) ||
          (order.project_name || "").toLowerCase().includes(term) ||
          assigneeNames.includes(term) ||
          orderCode.includes(term)
        );
      })
      .filter((order) => {
        if (activeTab === "active") return activeOrders.some((o) => o.id === order.id);
        if (activeTab === "closed") return closedOrders.some((o) => o.id === order.id);
        return true;
      })
      .filter((order) => {
        if (statusFilter === "active") return activeOrders.some((o) => o.id === order.id);
        if (statusFilter === "closed") return closedOrders.some((o) => o.id === order.id);
        if (statusFilter === "overdue") return overdueOrders.some((o) => o.id === order.id);
        return true;
      });
  }, [workOrders, searchTerm, activeTab, statusFilter, activeOrders, closedOrders, overdueOrders]);


  const assigneeLabel = selectedAssignees.length
    ? `${selectedAssignees.length} valda`
    : "Välj personer";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-heading">Arbetsorder</h2>
          <p className="text-muted-foreground">
            Skapa och hantera arbetsorder för ditt team
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ny arbetsorder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Skapa ny arbetsorder</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="work-title">
                  Titel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="work-title"
                  placeholder="Beskriv arbetet kort..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-description">Beskrivning</Label>
                <Textarea
                  id="work-description"
                  placeholder="Detaljerad beskrivning av arbetet..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-instructions">Instruktioner</Label>
                <Textarea
                  id="work-instructions"
                  placeholder="Specifika instruktioner för utförandet..."
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Projekt</Label>
                  <Select
                    value={projectId || "none"}
                    onValueChange={(value) => setProjectId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj projekt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tilldela till</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="truncate">{assigneeLabel}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-2" align="start">
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {users.length === 0 && (
                            <p className="text-xs text-muted-foreground">Inga användare hittades.</p>
                          )}
                          {users.map((user) => {
                            const displayName = user.full_name || user.email || `User ${user.id}`;
                            const isChecked = selectedAssignees.includes(user.id);
                            return (
                              <label key={user.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    setSelectedAssignees((prev) =>
                                      checked
                                        ? [...prev, user.id]
                                        : prev.filter((id) => id !== user.id)
                                    );
                                  }}
                                />
                                <span className="truncate">{displayName}</span>
                              </label>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Prioritet</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Medium" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Låg</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">Hög</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work-deadline">Deadline</Label>
                  <Input
                    id="work-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-address">Arbetsadress</Label>
                <Input
                  id="work-address"
                  placeholder="Adress där arbetet ska utföras"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work-contact">Kontaktperson</Label>
                  <Input
                    id="work-contact"
                    placeholder="Namn på kontaktperson"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work-phone">Kontakttelefon</Label>
                  <Input
                    id="work-phone"
                    placeholder="Telefonnummer"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Avbryt</Button>
              </DialogClose>
              <Button className="bg-slate-400 hover:bg-slate-500" onClick={handleCreate} disabled={saving}>
                {saving ? "Skapar..." : "Skapa arbetsorder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-6 space-y-1">
            <p className="text-sm text-muted-foreground">Totalt</p>
            <p className="text-2xl font-bold font-heading">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-6 space-y-1">
            <p className="text-sm text-muted-foreground">Aktiva</p>
            <p className="text-2xl font-bold font-heading text-blue-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-6 space-y-1">
            <p className="text-sm text-muted-foreground">Avslutade</p>
            <p className="text-2xl font-bold font-heading text-emerald-600">{closedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-6 space-y-1">
            <p className="text-sm text-muted-foreground">Försenade</p>
            <p className="text-2xl font-bold font-heading text-red-600">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök arbetsordrar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 text-muted-foreground mr-2" />
            <SelectValue placeholder="Alla statusar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla statusar</SelectItem>
            <SelectItem value="active">Aktiva</SelectItem>
            <SelectItem value="closed">Avslutade</SelectItem>
            <SelectItem value="overdue">Försenade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Alla</TabsTrigger>
          <TabsTrigger value="active">Aktiva</TabsTrigger>
          <TabsTrigger value="closed">Avslutade</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-card">
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordernr</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Tilldelad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioritet</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Laddar arbetsordrar...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Inga arbetsordrar hittades
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const overdue = isOverdue(order);
                  const status = normalizeStatus(order.status);
                  const statusLabel =
                    status === "attested"
                      ? "Attesterad"
                      : status === "closed"
                      ? "Avslutad"
                      : status === "paused"
                      ? "Pausad"
                      : status === "in_progress"
                      ? "Pågående"
                      : status === "not_started"
                      ? "Ej påbörjad"
                      : overdue
                      ? "Försenad"
                      : "Aktiv";
                  const statusClass =
                    status === "paused"
                      ? "bg-orange-100 text-orange-700 border-orange-200"
                      : status === "in_progress"
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : status === "closed" || status === "attested"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-200";
                  const orderCode = `AO ${order.order_year}-${String(order.order_number).padStart(4, "0")}`;
                  const assigneeNames = (order.assignees || [])
                    .map((assignee) => assignee.full_name || assignee.email)
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{orderCode}</TableCell>
                      <TableCell>{order.title}</TableCell>
                      <TableCell>{order.project_name || "-"}</TableCell>
                      <TableCell>{assigneeNames || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusClass}>{statusLabel}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{order.priority || "medium"}</TableCell>
                      <TableCell>
                        {order.deadline
                          ? new Date(order.deadline).toLocaleDateString("sv-SE")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                          Visa
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Arbetsorder</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ordernr</p>
                <p className="font-medium">
                  AO {selectedOrder.order_year}-{String(selectedOrder.order_number).padStart(4, "0")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Titel</p>
                <p className="font-medium">{selectedOrder.title}</p>
              </div>
              {selectedOrder.report_text && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Utfört arbete</p>
                  <p className="whitespace-pre-wrap">{selectedOrder.report_text}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Avslutad av</p>
                  <p className="font-medium">{selectedOrder.closed_by_name || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Avslutad</p>
                  <p className="font-medium">
                    {selectedOrder.closed_at
                      ? new Date(selectedOrder.closed_at).toLocaleDateString("sv-SE")
                      : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Attesterad av</p>
                  <p className="font-medium">{selectedOrder.attested_by_name || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Attesterad</p>
                  <p className="font-medium">
                    {selectedOrder.attested_at
                      ? new Date(selectedOrder.attested_at).toLocaleDateString("sv-SE")
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Stäng</Button>
            </DialogClose>
            {selectedOrder && (
              <Button
                variant="outline"
                onClick={() => handleDownloadPdf(selectedOrder)}
                disabled={downloadingId === selectedOrder.id}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadingId === selectedOrder.id ? "Laddar..." : "Ladda ner PDF"}
              </Button>
            )}
            {selectedOrder && String(selectedOrder.status || "").toLowerCase() === "closed" && (
              <Button onClick={() => handleAttest(selectedOrder)} disabled={attesting}>
                {attesting ? "Attesterar..." : "Attestera"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkOrders;
