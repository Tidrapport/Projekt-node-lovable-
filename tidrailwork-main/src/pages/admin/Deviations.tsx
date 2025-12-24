import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, FileDown } from "lucide-react";

type DeviationReport = {
  id: string;
  title: string;
  description: string | null;
  severity: string | null;
  status: string | null;
  created_at: string;
  user_full_name?: string | null;
  user_email?: string | null;
  time_entry_date?: string | null;
  project_name?: string | null;
  time_entry_start?: string | null;
  time_entry_end?: string | null;
};

const severityLabel = (s?: string | null) => {
  switch (s) {
    case "low": return "Låg";
    case "medium": return "Medel";
    case "high": return "Hög";
    case "critical": return "Kritisk";
    default: return s || "Okänd";
  }
};

const statusLabel = (s?: string | null) => {
  switch (s) {
    case "open": return "Öppen";
    case "in_progress": return "Pågående";
    case "resolved": return "Löst";
    case "closed": return "Stängd";
    default: return s || "Okänd";
  }
};

export default function AdminDeviations() {
  const { isAdmin } = useAuth();
  const [deviations, setDeviations] = useState<DeviationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<DeviationReport | null>(null);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", status: "open" });
  const [saving, setSaving] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<DeviationReport | null>(null);
  const [images, setImages] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchDeviations();
  }, []);

  const fetchDeviations = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>("/deviation-reports?include_images=true");
      const mapped = (data || []).map((d) => ({
        ...d,
        id: String(d.id),
        images: d.images || [],
      }));
      const imgMap: Record<string, string[]> = {};
      mapped.forEach((d) => {
        imgMap[d.id] = (d.images || []).map((img: any) => img.storage_path);
      });
      setImages(imgMap);
      setDeviations(mapped);
    } catch (e: any) {
      toast.error(e.message || "Kunde inte hämta avvikelser");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (d: DeviationReport) => {
    setSelected(d);
    setForm({
      title: d.title,
      description: d.description || "",
      severity: d.severity || "medium",
      status: d.status || "open",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await apiFetch(`/deviation-reports/${selected.id}`, {
        method: "PUT",
        json: {
          title: form.title,
          description: form.description,
          severity: form.severity,
          status: form.status,
        },
      });
      toast.success("Avvikelse uppdaterad");
      setEditOpen(false);
      fetchDeviations();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte uppdatera avvikelse");
    } finally {
      setSaving(false);
    }
  };

  const openView = (d: DeviationReport) => {
    setViewEntry(d);
    setViewOpen(true);
  };

  const safeFormat = (value?: string | null, fmt = "d MMM yyyy") => {
    if (!value) return "Okänt datum";
    try {
      return format(new Date(value), fmt, { locale: sv });
    } catch {
      return value;
    }
  };

  const downloadPdf = (d: DeviationReport) => {
    const token = getToken();
    const base = import.meta.env.VITE_API_BASE_URL?.trim() || "";
    const url = base ? `${base}/deviation-reports/${d.id}/pdf` : `/deviation-reports/${d.id}/pdf`;
    fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Kunde inte hämta PDF");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `avvikelse_${d.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((e) => toast.error(e.message || "Kunde inte ladda ner PDF"));
  };

  if (!isAdmin) {
    return <div className="container mx-auto p-6">Behörighet saknas.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Avvikelser</h1>
        <p className="text-muted-foreground">Översikt av rapporterade avvikelser kopplade till tidrapporter.</p>
      </div>

      {loading ? (
        <Card><CardContent className="py-6">Laddar...</CardContent></Card>
      ) : deviations.length === 0 ? (
        <Card><CardContent className="py-6 text-muted-foreground">Inga avvikelser att visa.</CardContent></Card>
      ) : (
        deviations.map((d) => (
          <Card key={d.id} className="shadow-card">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{d.title}</CardTitle>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                  <span>{d.user_full_name || d.user_email}</span>
                  {d.time_entry_date && (
                    <span>
                      {format(new Date(d.time_entry_date), "d MMM yyyy", { locale: sv })}
                      {d.time_entry_start && d.time_entry_end ? ` • ${d.time_entry_start} - ${d.time_entry_end}` : ""}
                    </span>
                  )}
                  {d.project_name && <span>Projekt: {d.project_name}</span>}
                </div>
                {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                <div className="flex gap-2">
                  <Badge variant="outline">{severityLabel(d.severity)}</Badge>
                  <Badge variant="secondary">{statusLabel(d.status)}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openView(d)}><Eye className="h-4 w-4 mr-1" /> Visa</Button>
                <Button size="sm" variant="outline" onClick={() => downloadPdf(d)}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
                <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>Redigera</Button>
              </div>
            </CardHeader>
          </Card>
        ))
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Redigera avvikelse</DialogTitle>
            <DialogDescription>Uppdatera status och detaljer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Titel</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Beskrivning</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Allvarlighet</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Låg</SelectItem>
                    <SelectItem value="medium">Medel</SelectItem>
                    <SelectItem value="high">Hög</SelectItem>
                    <SelectItem value="critical">Kritisk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Öppen</SelectItem>
                    <SelectItem value="in_progress">Pågående</SelectItem>
                    <SelectItem value="resolved">Löst</SelectItem>
                    <SelectItem value="closed">Stängd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Avbryt</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Sparar..." : "Spara"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewEntry?.title}</DialogTitle>
            <DialogDescription>Detaljerad avvikelseinformation</DialogDescription>
          </DialogHeader>
          {viewEntry && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {viewEntry.user_full_name || viewEntry.user_email} • {safeFormat(viewEntry.time_entry_date)}
                {viewEntry.time_entry_start && viewEntry.time_entry_end ? ` • ${viewEntry.time_entry_start} - ${viewEntry.time_entry_end}` : ""}
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{severityLabel(viewEntry.severity)}</Badge>
                <Badge variant="secondary">{statusLabel(viewEntry.status)}</Badge>
              </div>
              <div className="text-sm"><strong>Projekt:</strong> {viewEntry.project_name || "-"}</div>
              <div className="text-sm"><strong>Beskrivning:</strong><br />{viewEntry.description || "-"}</div>
              {images[viewEntry.id]?.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images[viewEntry.id].map((src, idx) => (
                    <img key={idx} src={src} alt="Avvikelsebild" className="w-full h-32 object-cover rounded border" />
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => downloadPdf(viewEntry)}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
