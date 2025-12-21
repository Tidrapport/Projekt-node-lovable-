import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Briefcase, Plus, Trash2 } from "lucide-react";

interface JobRole {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

const AdminJobRoles = () => {
  const { companyId } = useAuth();
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchJobRoles();
  }, []);

  const fetchJobRoles = async () => {
    const data = await apiFetch(`/job-roles?order=name`);
    if (data) setJobRoles(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch(`/job-roles`, { method: "POST", json: { name, description, active: true, company_id: companyId } });

      toast.success("Yrkesroll skapad!");
      setShowDialog(false);
      setName("");
      setDescription("");
      fetchJobRoles();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/job-roles/${id}`, { method: "PUT", json: { active: !active } });
      toast.success(active ? "Yrkesroll inaktiverad" : "Yrkesroll aktiverad");
      fetchJobRoles();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte uppdatera yrkesroll");
    }
  };

  const deleteRole = async (id: string) => {
    try {
      await apiFetch(`/job-roles/${id}`, { method: "DELETE" });
      toast.success("Yrkesroll borttagen");
      fetchJobRoles();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort yrkesroll");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold font-heading">Yrkesroller</h2>
          <p className="text-muted-foreground">Hantera tillgängliga yrkesroller</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-gradient-primary">
          <Plus className="mr-2 h-4 w-4" />
          Ny yrkesroll
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobRoles.map((role) => (
          <Card key={role.id} className="shadow-card">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{role.name}</h3>
                  </div>
                  {!role.active && <Badge variant="outline">Inaktiv</Badge>}
                </div>
                {role.description && (
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(role.id, role.active)}
                  >
                    {role.active ? "Inaktivera" : "Aktivera"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteRole(role.id)}
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
            <DialogTitle>Ny yrkesroll</DialogTitle>
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
                {loading ? "Skapar..." : "Skapa yrkesroll"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminJobRoles;
