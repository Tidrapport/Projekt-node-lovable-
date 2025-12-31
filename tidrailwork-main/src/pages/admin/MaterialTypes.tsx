import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GuideButton } from "@/components/GuideButton";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Package, Plus, Trash2 } from "lucide-react";

interface MaterialType {
  id: string;
  name: string;
  description: string;
  unit: string;
  active: boolean;
}

const AdminMaterialTypes = () => {
  const { companyId } = useAuth();
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    fetchMaterialTypes();
  }, []);

  const fetchMaterialTypes = async () => {
    try {
      const data = await apiFetch<MaterialType[]>("/material-types?active=true");
      setMaterialTypes(data || []);
    } catch {
      setMaterialTypes([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch("/material-types", {
        method: "POST",
        json: { name, description, unit, active: true, company_id: companyId },
      });

      toast.success("Tillägg skapat!");
      setShowDialog(false);
      setName("");
      setDescription("");
      setUnit("");
      fetchMaterialTypes();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/material-types/${id}`, { method: "PUT", json: { active: !active } });
      toast.success(active ? "Tillägg inaktiverat" : "Tillägg aktiverat");
      fetchMaterialTypes();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte uppdatera");
    }
  };

  const deleteMaterialType = async (id: string) => {
    try {
      await apiFetch(`/material-types/${id}`, { method: "DELETE" });
      toast.success("Tillägg borttaget");
      fetchMaterialTypes();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte ta bort");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold font-heading">Tillägg</h2>
          <p className="text-muted-foreground">Hantera tillgängliga tillägg och materialtyper</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowDialog(true)} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nytt tillägg
          </Button>
          <GuideButton
            title="Guide: Tillägg & artiklar"
            steps={[
              "Skapa material/tillägg med tydligt namn och enhet.",
              "Använd samma enhet som i Fortnox-artikeln (st, h, m).",
              "Använd tillägg i tidrapport för att få med dem på faktura.",
              "Kontrollera prislista/artikelkoppling om ni fakturerar via Fortnox.",
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materialTypes.map((material) => (
          <Card key={material.id} className="shadow-card">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{material.name}</h3>
                  </div>
                  {!material.active && <Badge variant="outline">Inaktiv</Badge>}
                </div>
                {material.description && (
                  <p className="text-sm text-muted-foreground">{material.description}</p>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Enhet: </span>
                  <span className="font-medium">{material.unit}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(material.id, material.active)}
                  >
                    {material.active ? "Inaktivera" : "Aktivera"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMaterialType(material.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nytt tillägg</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Namn</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Enhet (t.ex. st, kg, liter, mil)</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivning</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Skapar..." : "Skapa tillägg"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMaterialTypes;
