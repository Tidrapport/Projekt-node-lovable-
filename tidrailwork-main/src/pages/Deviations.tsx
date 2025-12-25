import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { toast } from "sonner";
import { AlertTriangle, Plus, Upload, X, Pencil, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface Deviation {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  resolved_at?: string | null;
  created_at: string;
  time_entry_id?: string;
  time_entry: {
    date: string;
    project: { name: string };
  };
}

interface TimeEntry {
  id: string;
  date: string;
  project: { name: string };
  start_time?: string | null;
  end_time?: string | null;
}

const Deviations = () => {
  const { user, companyId } = useAuth();
  const { effectiveUserId, isImpersonating, impersonatedUserName } = useEffectiveUser();
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  // Form state
  const [timeEntryId, setTimeEntryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState("open");
  const [resolvedAt, setResolvedAt] = useState("");

  useEffect(() => {
    fetchData();
  }, [effectiveUserId]);

  const fetchData = async () => {
    if (!effectiveUserId) return;

    // Fetch deviations
    try {
      const deviationsData = await apiFetch(`/deviation-reports?user_id=${effectiveUserId}`);
      if (deviationsData) {
        const mapped = (deviationsData || []).map((d: any) => ({
          id: String(d.id),
          title: d.title,
          description: d.description || "",
          severity: d.severity || "medium",
          status: d.status || "open",
          resolved_at: d.resolved_at || null,
          created_at: d.created_at || "",
          time_entry_id: d.time_entry_id ? String(d.time_entry_id) : undefined,
          time_entry: {
            date: d.time_entry_date || d.datum || d.date,
            project: { name: d.project_name || d.project?.name || "Projekt" },
          },
        }));
        setDeviations(mapped);
      }
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta avvikelser");
    }

    // Fetch time entries for dropdown (för aktuell användare)
    try {
      const entriesData = await apiFetch(`/time-entries?limit=30`);
      if (entriesData) {
        const mapped = (entriesData || [])
          .filter((e: any) => e.datum || e.date)
          .map((e: any) => ({
            id: String(e.id),
            date: e.datum || e.date,
            project: { name: e.project?.name || e.project_name || "Projekt" },
            start_time: e.start_time || e.starttid || null,
            end_time: e.end_time || e.sluttid || null,
          }));
        setTimeEntries(mapped);
      }
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta tidrapporter");
      setTimeEntries([]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages([...images, ...Array.from(e.target.files)]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const safeFormat = (value: string | undefined | null, fmt: string) => {
    if (!value) return "Okänt datum";
    try {
      return format(new Date(value), fmt, { locale: sv });
    } catch {
      return "Okänt datum";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        time_entry_id: timeEntryId,
        title,
        description,
        severity,
        status,
        resolved_at: resolvedAt ? new Date(resolvedAt).toISOString() : null,
        company_id: companyId,
      };

      let deviationData;
      if (isEditing && editingId) {
        deviationData = await apiFetch(`/deviation-reports/${editingId}`, {
          method: "PUT",
          json: payload,
        });
      } else {
        deviationData = await apiFetch("/deviation-reports", {
          method: "POST",
          json: payload,
        });
      }

      if (!deviationData) throw new Error("Kunde inte spara avvikelse");

      if (!isEditing && images.length > 0) {
        toast.warning("Bilduppladdning stöds ännu inte i backend, rapporten sparades ändå.");
      }

      toast.success(isEditing ? "Avvikelsen uppdaterades" : "Avvikelserapport skapad!");
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTimeEntryId("");
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setStatus("open");
    setResolvedAt("");
    setEditingId(null);
    setIsEditing(false);
    setImages([]);
  };

  const openEditDialog = (deviation: Deviation) => {
    setIsEditing(true);
    setEditingId(deviation.id);
    setTimeEntryId(deviation.time_entry_id || "");
    setTitle(deviation.title);
    setDescription(deviation.description);
    setSeverity(deviation.severity || "medium");
    setStatus(deviation.status || "open");
    setResolvedAt(deviation.resolved_at ? deviation.resolved_at.slice(0, 10) : "");
    setShowDialog(true);
  };

  const markResolvedToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStatus("resolved");
    setResolvedAt(today);
  };

  const quickResolve = (deviation: Deviation) => {
    openEditDialog(deviation);
    const today = new Date().toISOString().slice(0, 10);
    setStatus("resolved");
    setResolvedAt(today);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-destructive";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      default: return "bg-muted";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-red-500";
      case "in_progress": return "bg-yellow-500";
      case "resolved": return "bg-green-500";
      case "closed": return "bg-muted";
      default: return "bg-muted";
    }
  };

  const severityLabel = (value: string) => {
    switch (value) {
      case "critical": return "Kritisk";
      case "high": return "Hög";
      case "medium": return "Medel";
      case "low": return "Låg";
      default: return value;
    }
  };

  const statusLabel = (value: string) => {
    switch (value) {
      case "open": return "Öppen";
      case "in_progress": return "Pågår";
      case "resolved": return "Åtgärdad";
      case "closed": return "Stängd";
      default: return value;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold font-heading">
            Avvikelser {isImpersonating && <span className="text-lg font-normal text-muted-foreground">- {impersonatedUserName}</span>}
          </h2>
          <p className="text-muted-foreground">
            {isImpersonating ? `Visar ${impersonatedUserName}s avvikelser` : "Rapportera och hantera avvikelser med bilder"}
          </p>
        </div>
        {!isImpersonating && (
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-gradient-accent"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ny avvikelse
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {deviations.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Inga avvikelser rapporterade</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          deviations.map((deviation) => (
            <Card key={deviation.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{deviation.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {safeFormat(deviation.created_at, "d MMMM yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getSeverityColor(deviation.severity)}>
                        {severityLabel(deviation.severity)}
                      </Badge>
                      <Badge className={getStatusColor(deviation.status)}>
                        {statusLabel(deviation.status)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm">{deviation.description}</p>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Projekt:</span>{" "}
                    {deviation.time_entry?.project?.name} -{" "}
                    {safeFormat(deviation.time_entry?.date, "d MMM yyyy")}
                  </div>
                  {deviation.resolved_at && (
                    <div className="text-sm text-muted-foreground">
                      Åtgärdad: {safeFormat(deviation.resolved_at, "d MMM yyyy")}
                    </div>
                  )}
                  {!isImpersonating && (
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(deviation)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Redigera
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => quickResolve(deviation)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Markera åtgärdad
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Redigera avvikelse" : "Ny avvikelserapport"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeEntry">Tidrapport</Label>
              <Select value={timeEntryId} onValueChange={setTimeEntryId} required disabled={isImpersonating}>
                <SelectTrigger id="timeEntry">
                  <SelectValue placeholder="Välj tidrapport" />
                </SelectTrigger>
                <SelectContent>
                  {timeEntries.map((entry) => {
                    const labelDate = safeFormat(entry.date, "d MMM yyyy");
                    const timeRange = entry.start_time && entry.end_time ? ` • ${entry.start_time} - ${entry.end_time}` : "";
                    return (
                      <SelectItem key={entry.id} value={entry.id}>
                        {labelDate}{timeRange} – {entry.project?.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kort beskrivning av avvikelsen"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Allvarlighetsgrad</Label>
              <Select value={severity} onValueChange={setSeverity} required>
                <SelectTrigger id="severity">
                  <SelectValue placeholder="Välj" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Låg</SelectItem>
                  <SelectItem value="medium">Medel</SelectItem>
                  <SelectItem value="high">Hög</SelectItem>
                  <SelectItem value="critical">Kritisk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Välj status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Öppen</SelectItem>
                  <SelectItem value="in_progress">Pågår</SelectItem>
                  <SelectItem value="resolved">Åtgärdad</SelectItem>
                  <SelectItem value="closed">Stängd</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolvedAt">Åtgärdad datum (om åtgärdad)</Label>
              <Input
                id="resolvedAt"
                type="date"
                value={resolvedAt}
                onChange={(e) => setResolvedAt(e.target.value)}
                disabled={status !== "resolved" && resolvedAt === ""}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={markResolvedToday}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Sätt till åtgärdad idag
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beskrivning</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detaljerad beskrivning av avvikelsen..."
                rows={5}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="images">Bilder</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label htmlFor="images" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Klicka för att ladda upp bilder
                  </p>
                </label>
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Avbryt
              </Button>
              <Button type="submit" className="bg-gradient-accent" disabled={loading}>
                {loading ? "Sparar..." : "Skapa avvikelserapport"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deviations;
