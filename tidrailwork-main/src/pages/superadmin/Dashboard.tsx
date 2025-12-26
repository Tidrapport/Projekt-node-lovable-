import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/api/client";
import { toast } from "sonner";
import { Building2, Copy, Eye, Plus, Trash2, Users } from "lucide-react";

type Company = {
  id: string;
  name: string;
  code?: string | null;
  billing_email?: string | null;
  created_at?: string | null;
  user_count?: number;
};

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyBillingEmail, setNewCompanyBillingEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const aiEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!aiMessages.length) return;
    aiEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMessages]);

  const fetchCompanies = async () => {
    try {
      const companiesData = await apiFetch(`/companies`);
      const withCounts = await Promise.all(
        (companiesData || []).map(async (company: any) => {
          try {
            const users = await apiFetch(`/admin/users?company_id=${company.id}`);
            return { ...company, user_count: (users || []).length };
          } catch {
            return { ...company, user_count: 0 };
          }
        })
      );
      setCompanies(withCounts);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Kunde inte hämta företag");
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Företagsnamn krävs");
      return;
    }
    if (!adminEmail.trim() || !adminPassword.trim() || !adminFirstName.trim() || !adminLastName.trim()) {
      toast.error("Fyll i uppgifter för admin (namn, e-post, lösenord)");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/companies", {
        method: "POST",
        json: {
          name: newCompanyName,
          billing_email: newCompanyBillingEmail || null,
          admin_first_name: adminFirstName,
          admin_last_name: adminLastName,
          admin_email: adminEmail,
          admin_password: adminPassword,
        },
      });
      toast.success("Företag skapat");
      setShowNewCompanyDialog(false);
      setNewCompanyName("");
      setNewCompanyBillingEmail("");
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      setAdminPassword("");
      fetchCompanies();
    } catch (err: any) {
      console.error("Error creating company:", err);
      toast.error(err.message || "Kunde inte skapa företag");
    } finally {
      setCreating(false);
    }
  };

  const updateCompany = async () => {
    if (!editingCompany) return;
    setSaving(true);
    try {
      await apiFetch(`/companies/${editingCompany.id}`, {
        method: "PUT",
        json: {
          name: editingCompany.name,
          billing_email: editingCompany.billing_email,
          code: editingCompany.code,
        },
      });
      toast.success("Företag uppdaterat");
      setEditingCompany(null);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte uppdatera företag");
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Ta bort ${companyName}? Detta går inte att ångra.`)) return;
    try {
      await apiFetch(`/companies/${companyId}`, { method: "DELETE" });
      toast.success("Företag borttaget");
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ta bort företag");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Företagskod kopierad");
  };

  const sendAi = async () => {
    const content = aiInput.trim();
    if (!content || aiLoading) return;

    const nextMessages = [...aiMessages, { role: "user", content }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await apiFetch<{ reply?: string }>("/superadmin/ai", {
        method: "POST",
        json: { messages: nextMessages },
      });
      const reply = String(res?.reply || "").trim() || "Inget svar från AI.";
      setAiMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast.error(err.message || "AI-felsökning misslyckades");
      setAiMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "Kunde inte nå AI-tjänsten. Kontrollera nyckel och server.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Super Admin</h1>
          <p className="text-muted-foreground">Hantera företag och tillhörande admins</p>
        </div>
        <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nytt företag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skapa nytt företag + admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Företagsnamn</Label>
                <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Företag AB" />
              </div>
              <div className="space-y-2">
                <Label>Faktura-email</Label>
                <Input type="email" value={newCompanyBillingEmail} onChange={(e) => setNewCompanyBillingEmail(e.target.value)} placeholder="faktura@foretag.se" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Admin förnamn</Label>
                  <Input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Admin efternamn</Label>
                  <Input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admin e-post</Label>
                <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Admin lösenord</Label>
                <Input type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Starkt lösenord" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCompanyDialog(false)}>
                Avbryt
              </Button>
              <Button onClick={createCompany} disabled={creating}>
                {creating ? "Skapar..." : "Skapa företag"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totalt antal företag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{companies.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totalt antal användare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{companies.reduce((sum, c) => sum + (c.user_count || 0), 0)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Skapade sista veckan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {companies.filter((c) => c.created_at && new Date(c.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla företag</CardTitle>
          <CardDescription>Hantera företag och tillhörande admins</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Företag</TableHead>
                <TableHead>Faktura-email</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Användare</TableHead>
                <TableHead>Skapat</TableHead>
                <TableHead>Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{company.billing_email || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded">{company.code || "—"}</code>
                      {company.code && (
                        <Button variant="ghost" size="icon" onClick={() => copyCode(company.code!)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{company.user_count || 0}</TableCell>
                  <TableCell>{company.created_at ? new Date(company.created_at).toLocaleDateString("sv-SE") : "-"}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingCompany(company)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Redigera
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteCompany(company.id, company.name)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Ta bort
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera företag</DialogTitle>
          </DialogHeader>
          {editingCompany && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Företagsnamn</Label>
                <Input value={editingCompany.name} onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Faktura-email</Label>
                <Input
                  value={editingCompany.billing_email || ""}
                  onChange={(e) => setEditingCompany({ ...editingCompany, billing_email: e.target.value })}
                  placeholder="faktura@foretag.se"
                />
              </div>
              <div className="space-y-2">
                <Label>Företagskod</Label>
                <Input value={editingCompany.code || ""} onChange={(e) => setEditingCompany({ ...editingCompany, code: e.target.value })} placeholder="t.ex. ABC123" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>
              Avbryt
            </Button>
            <Button onClick={updateCompany} disabled={!editingCompany || saving}>
              {saving ? "Sparar..." : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>AI-felsökare</CardTitle>
          <CardDescription>Klistra in felkod/logg för snabb hjälp (endast Super Admin).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-56 rounded-md border bg-muted/30">
            <div className="space-y-3 p-3">
              {aiMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ingen historik ännu. Lägg in en felkod eller beskrivning.
                </p>
              )}
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-md bg-background p-3 shadow-sm">
                  <p className="text-xs uppercase text-muted-foreground">
                    {message.role === "user" ? "Du" : "AI"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              ))}
              <div ref={aiEndRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Label>Felkod eller problem</Label>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ex: 404 Not Found på /auth/me efter lösenordsbyte..."
              rows={4}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              AI svarar utifrån det du klistrar in – dela inte känsliga uppgifter.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAiMessages([])}
                disabled={aiLoading || aiMessages.length === 0}
              >
                Rensa
              </Button>
              <Button onClick={sendAi} disabled={aiLoading || !aiInput.trim()}>
                {aiLoading ? "Analyserar..." : "Analysera"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;
