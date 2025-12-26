import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { apiFetch } from "@/api/client";
import { toast } from "sonner";
import { ClipboardCheck, MessageSquare, Play, CheckCircle2, MapPin, User } from "lucide-react";

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
  project_name?: string | null;
  priority?: string | null;
  deadline?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  status?: string | null;
  report_text?: string | null;
  comments_count?: number | null;
  assignees?: WorkOrderAssignee[];
};

type WorkOrderComment = {
  id: number;
  comment: string;
  created_at: string;
  user_id: number;
  full_name?: string | null;
  email?: string | null;
};

const WorkOrders = () => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [activeTab, setActiveTab] = useState("active");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [reportText, setReportText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<WorkOrderComment[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [closingOrder, setClosingOrder] = useState(false);
  const [startingOrder, setStartingOrder] = useState<number | null>(null);
  const [pausingOrder, setPausingOrder] = useState<number | null>(null);
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<WorkOrder[]>("/work-orders/assigned");
      setOrders(data || []);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta arbetsordrar");
    } finally {
      setLoading(false);
    }
  };

  const openReportDialog = async (order: WorkOrder) => {
    setSelectedOrder(order);
    setReportText(order.report_text || "");
    setCommentText("");
    try {
      const data = await apiFetch<WorkOrderComment[]>(`/work-orders/${order.id}/comments`);
      setComments(data || []);
    } catch {
      setComments([]);
    }
  };

  const handleStart = async (order: WorkOrder) => {
    setStartingOrder(order.id);
    try {
      await apiFetch(`/work-orders/${order.id}/start`, { method: "POST" });
      toast.success("Arbetsorder påbörjad");
      fetchOrders();
      openReportDialog({ ...order, status: "in_progress" });
    } catch (error: any) {
      toast.error(error.message || "Kunde inte påbörja arbetsorder");
    } finally {
      setStartingOrder(null);
    }
  };

  const handlePause = async () => {
    if (!selectedOrder) return;
    setPausingOrder(selectedOrder.id);
    try {
      await apiFetch(`/work-orders/${selectedOrder.id}/pause`, { method: "POST" });
      toast.success("Arbetsorder pausad");
      fetchOrders();
      setSelectedOrder({ ...selectedOrder, status: "paused" });
    } catch (error: any) {
      toast.error(error.message || "Kunde inte pausa arbetsorder");
    } finally {
      setPausingOrder(null);
    }
  };

  const handleSaveReport = async () => {
    if (!selectedOrder) return;
    if (!reportText.trim()) {
      toast.error("Beskriv utfört arbete");
      return;
    }
    setSavingReport(true);
    try {
      await apiFetch(`/work-orders/${selectedOrder.id}/report`, {
        method: "POST",
        json: { report_text: reportText.trim() },
      });
      toast.success("Rapport sparad");
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara rapport");
    } finally {
      setSavingReport(false);
    }
  };

  const handleCloseOrder = async () => {
    if (!selectedOrder) return;
    if (!reportText.trim()) {
      toast.error("Beskriv utfört arbete");
      return;
    }
    setClosingOrder(true);
    try {
      await apiFetch(`/work-orders/${selectedOrder.id}/close`, {
        method: "POST",
        json: { report_text: reportText.trim() },
      });
      toast.success("Arbetsorder avslutad");
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte avsluta arbetsorder");
    } finally {
      setClosingOrder(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedOrder || !commentText.trim()) return;
    setAddingComment(true);
    try {
      await apiFetch(`/work-orders/${selectedOrder.id}/comments`, {
        method: "POST",
        json: { comment: commentText.trim() },
      });
      setCommentText("");
      const data = await apiFetch<WorkOrderComment[]>(`/work-orders/${selectedOrder.id}/comments`);
      setComments(data || []);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara kommentar");
    } finally {
      setAddingComment(false);
    }
  };

  const normalizeStatus = (status?: string | null) => {
    const value = String(status || "not_started").toLowerCase();
    if (value === "active") return "not_started";
    return value;
  };

  const activeOrders = orders.filter((order) => {
    const status = normalizeStatus(order.status);
    return status !== "closed" && status !== "attested";
  });
  const closedOrders = orders.filter((order) => {
    const status = normalizeStatus(order.status);
    return status === "closed" || status === "attested";
  });

  const visibleOrders = useMemo(() => {
    return activeTab === "closed" ? closedOrders : activeOrders;
  }, [activeTab, activeOrders, closedOrders]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-heading">Mina arbetsordrar</h2>
        <p className="text-muted-foreground">Hantera och rapportera dina tilldelade arbetsordrar</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Aktiva ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="closed">Avslutade ({closedOrders.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">Laddar arbetsordrar...</CardContent>
        </Card>
      ) : visibleOrders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">Inga arbetsordrar hittades</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleOrders.map((order) => {
            const status = normalizeStatus(order.status);
            const orderCode = `AO ${order.order_year}-${String(order.order_number).padStart(4, "0")}`;
            const statusLabel =
              status === "attested"
                ? "Avslutad"
                : status === "closed"
                ? "Avslutad"
                : status === "paused"
                ? "Pausad"
                : status === "in_progress"
                ? "Pågående"
                : "Ej påbörjad";
            const statusClass =
              status === "paused"
                ? "bg-orange-100 text-orange-700 border-orange-200"
                : status === "in_progress"
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : status === "closed" || status === "attested"
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200";
            const canStart = status === "not_started" || status === "paused";
            return (
              <Card key={order.id} className="shadow-card">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{orderCode}</span>
                    <Badge className={statusClass}>
                      {statusLabel}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{order.title}</h3>
                    {order.project_name && (
                      <p className="text-sm text-muted-foreground">{order.project_name}</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{order.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {order.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {order.address}
                      </span>
                    )}
                    {order.contact_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {order.contact_name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canStart && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStart(order)}
                        disabled={startingOrder === order.id}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {startingOrder === order.id
                          ? "Startar..."
                          : status === "paused"
                          ? "Fortsätt"
                          : "Påbörja"}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => openReportDialog(order)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Rapportera
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Arbetsrapport</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  AO {selectedOrder.order_year}-{String(selectedOrder.order_number).padStart(4, "0")}
                </p>
                <p className="text-lg font-semibold">{selectedOrder.title}</p>
              </div>
              {selectedOrder.description && (
                <div>
                  <p className="text-sm font-medium">Beskrivning</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.description}</p>
                </div>
              )}
              {selectedOrder.instructions && (
                <div>
                  <p className="text-sm font-medium">Instruktioner</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.instructions}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Arbetsrapport</p>
                <Textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Beskriv utfört arbete..."
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleSaveReport} disabled={savingReport}>
                  {savingReport ? "Sparar..." : "Spara"}
                </Button>
                {normalizeStatus(selectedOrder.status) === "in_progress" && (
                  <Button variant="outline" onClick={handlePause} disabled={pausingOrder === selectedOrder.id}>
                    {pausingOrder === selectedOrder.id ? "Pausar..." : "Pausa"}
                  </Button>
                )}
                <Button onClick={handleCloseOrder} disabled={closingOrder}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {closingOrder ? "Avslutar..." : "Avsluta arbete"}
                </Button>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">
                  Kommentarer ({comments.length})
                </p>
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Skriv en kommentar..."
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleAddComment} disabled={addingComment}>
                    {addingComment ? "Sparar..." : "Skicka"}
                  </Button>
                </div>
                {comments.length > 0 && (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border p-3">
                        <p className="text-sm">{comment.comment}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {comment.full_name || comment.email || "Användare"} ·{" "}
                          {new Date(comment.created_at).toLocaleString("sv-SE")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Stäng</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkOrders;
