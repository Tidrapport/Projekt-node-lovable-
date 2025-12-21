import { useState, useEffect } from "react";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Edit, Image as ImageIcon } from "lucide-react";

interface DeviationReport {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  user_id: string;
  time_entry_id: string;
  profiles: {
    full_name: string;
  };
  time_entries: {
    date: string;
    projects: {
      name: string;
    };
  };
}

interface DeviationImage {
  id: string;
  storage_path: string;
  created_at: string;
}

export default function AdminDeviations() {
  const [deviations, setDeviations] = useState<DeviationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false);
  const [selectedDeviation, setSelectedDeviation] = useState<DeviationReport | null>(null);
  const [deviationImages, setDeviationImages] = useState<DeviationImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    severity: "",
    status: "",
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchDeviations();
  }, []);

  const fetchDeviations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("deviation_reports")
        .select(`
          *,
          profiles!deviation_reports_user_id_fkey (
            full_name
          ),
          time_entries (
            date,
            projects (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeviations(data || []);
    } catch (error: any) {
      console.error("Error fetching deviations:", error);
      toast.error("Kunde inte hämta avvikelser");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeviationImages = async (deviationId: string) => {
    try {
      const { data, error } = await supabase
        .from("deviation_images")
        .select("*")
        .eq("deviation_report_id", deviationId);

      if (error) throw error;
      
      setDeviationImages(data || []);

      // Fetch signed URLs for all images
      const urls: Record<string, string> = {};
      for (const image of data || []) {
        const { data: urlData } = await supabase.storage
          .from("deviation-images")
          .createSignedUrl(image.storage_path, 3600); // 1 hour expiry
        
        if (urlData?.signedUrl) {
          urls[image.id] = urlData.signedUrl;
        }
      }
      setImageUrls(urls);
    } catch (error: any) {
      console.error("Error fetching images:", error);
      toast.error("Kunde inte hämta bilder");
    }
  };

  const handleEdit = (deviation: DeviationReport) => {
    setSelectedDeviation(deviation);
    setEditForm({
      title: deviation.title,
      description: deviation.description,
      severity: deviation.severity,
      status: deviation.status,
    });
    setEditDialogOpen(true);
  };

  const handleViewImages = (deviation: DeviationReport) => {
    setSelectedDeviation(deviation);
    fetchDeviationImages(deviation.id);
    setImagesDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedDeviation) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from("deviation_reports")
        .update({
          title: editForm.title,
          description: editForm.description,
          severity: editForm.severity,
          status: editForm.status,
        })
        .eq("id", selectedDeviation.id);

      if (error) throw error;

      toast.success("Avvikelse uppdaterad");
      setEditDialogOpen(false);
      fetchDeviations();
    } catch (error: any) {
      console.error("Error updating deviation:", error);
      toast.error("Kunde inte uppdatera avvikelse");
    } finally {
      setUpdating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
      case "high":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "low":
        return "Låg";
      case "medium":
        return "Medel";
      case "high":
        return "Hög";
      default:
        return severity;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "in_progress":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "closed":
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Öppen";
      case "in_progress":
        return "Pågående";
      case "resolved":
        return "Löst";
      case "closed":
        return "Stängd";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Laddar avvikelser...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Avvikelsehantering</h1>
          <p className="text-muted-foreground mt-1">
            Hantera och granska alla avvikelserapporter
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {deviations.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">Inga avvikelser rapporterade</p>
            </CardContent>
          </Card>
        ) : (
          deviations.map((deviation) => (
            <Card key={deviation.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-xl">{deviation.title}</CardTitle>
                    </div>
                    <CardDescription>
                      Rapporterad av: {deviation.profiles.full_name} | 
                      Datum: {format(new Date(deviation.time_entries.date), "d MMMM yyyy", { locale: sv })} | 
                      Projekt: {deviation.time_entries.projects.name}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={getSeverityColor(deviation.severity)}>
                      {getSeverityLabel(deviation.severity)}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(deviation.status)}>
                      {getStatusLabel(deviation.status)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">
                  {deviation.description}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => handleEdit(deviation)} variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Redigera
                  </Button>
                  <Button onClick={() => handleViewImages(deviation)} variant="outline" size="sm">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Visa bilder
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Skapad: {format(new Date(deviation.created_at), "d MMMM yyyy HH:mm", { locale: sv })}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Redigera avvikelse</DialogTitle>
            <DialogDescription>
              Uppdatera information om avvikelsen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Titel</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Beskrivning</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-severity">Allvarlighetsgrad</Label>
                <Select value={editForm.severity} onValueChange={(value) => setEditForm({ ...editForm, severity: value })}>
                  <SelectTrigger id="edit-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Låg</SelectItem>
                    <SelectItem value="medium">Medel</SelectItem>
                    <SelectItem value="high">Hög</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
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
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handleUpdate} disabled={updating}>
                {updating ? "Uppdaterar..." : "Spara ändringar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Images Dialog */}
      <Dialog open={imagesDialogOpen} onOpenChange={setImagesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Uppladdade bilder</DialogTitle>
            <DialogDescription>
              Bilder kopplade till avvikelsen: {selectedDeviation?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {deviationImages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Inga bilder uppladdade</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deviationImages.map((image) => (
                  <div key={image.id} className="border rounded-lg overflow-hidden">
                    {imageUrls[image.id] ? (
                      <img
                        src={imageUrls[image.id]}
                        alt="Avvikelsebild"
                        className="w-full h-64 object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                        <p className="text-muted-foreground">Laddar bild...</p>
                      </div>
                    )}
                    <div className="p-2 bg-muted">
                      <p className="text-xs text-muted-foreground">
                        Uppladdad: {format(new Date(image.created_at), "d MMM yyyy HH:mm", { locale: sv })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
