import { useEffect, useState } from "react";
import { apiFetch } from "@/api/client";
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
  images?: { storage_path: string }[];
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
      const imgs: Record<string, string[]> = {};
      mapped.forEach((d) => {
        imgs[d.id] = (d.images || []).map((img: any) => img.storage_path);
      });
      setImages(imgs);
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

  const downloadPdf = (d: DeviationReport) => {
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    const dateStr = d.time_entry_date ? (() => { try { return format(new Date(d.time_entry_date), "d MMM yyyy", { locale: sv }); } catch { return d.time_entry_date; } })() : "";
    const imgs = images[d.id] || [];
    w.document.write(`
      <html><head><title>Avvikelse ${d.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        .meta { margin-bottom: 8px; color: #444; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; margin-right: 6px; }
        .images img { height: 120px; margin: 4px; border: 1px solid #ccc; border-radius: 4px; object-fit: cover; }
      </style>
      </head><body>
        <h1>${d.title}</h1>
        <div class="meta">
          <div>Användare: ${d.user_full_name || d.user_email || "-"}</div>
          <div>Projekt: ${d.project_name || "-"}</div>
          <div>Datum: ${dateStr}</div>
          <div>Skift: ${d.time_entry_start || ""} ${d.time_entry_end ? " - " + d.time_entry_end : ""}</div>
          <div>Status: ${statusLabel(d.status)}</div>
          <div>Allvarlighet: ${severityLabel(d.severity)}</div>
        </div>
        <div><strong>Beskrivning</strong><br/>${d.description || "-"}</div>
        ${imgs.length ? `<div class="images"><strong>Bilder</strong><br/>${imgs.map(src => `<img src="${src}" />`).join("")}</div>` : ""}
        <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
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
                {images[d.id]?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {images[d.id].map((src, idx) => (
                      <img key={`${d.id}-${idx}`} src={src} alt="Avvikelsebild" className="h-20 w-20 object-cover rounded border" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(d)}>Redigera</Button>
                <Button size="sm" variant="secondary" onClick={() => downloadPdf(d)}>Ladda ner PDF</Button>
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
    </div>
  );
}
