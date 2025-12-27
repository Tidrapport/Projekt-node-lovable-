import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type AdminUser = {
  id: string | number;
  full_name?: string | null;
  email: string;
  role?: string | null;
  is_active?: number | null;
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

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogTitle, setPasswordDialogTitle] = useState("");
  const [passwordDialogDescription, setPasswordDialogDescription] = useState("");
  const [passwordDialogValue, setPasswordDialogValue] = useState("");

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const aiEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!editingCompany?.id) {
      setAdminUsers([]);
      setSelectedAdminId("");
      return;
    }
    fetchCompanyAdmins(String(editingCompany.id));
  }, [editingCompany?.id]);

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

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return `${pwd}Aa1`;
  };

  const fetchCompanyAdmins = async (companyId: string) => {
    setLoadingAdmins(true);
    try {
      const data = await apiFetch<AdminUser[]>(`/admin/users?company_id=${companyId}&include_inactive=1`);
      const admins = (data || []).filter(
        (u) => String(u.role || "").toLowerCase() === "admin"
      );
      setAdminUsers(admins);
      if (admins.length) {
        setSelectedAdminId(String(admins[0].id));
      } else {
        setSelectedAdminId("");
      }
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta admin-användare");
      setAdminUsers([]);
      setSelectedAdminId("");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleResetAdminPassword = async () => {
    const admin = adminUsers.find((u) => String(u.id) === String(selectedAdminId));
    if (!admin) {
      toast.error("Välj en admin att återställa");
      return;
    }
    setLoadingAdmins(true);
    const password = generatePassword();
    try {
      await apiFetch(`/admin/users/${admin.id}/reset-password`, {
        method: "POST",
        json: { password },
      });
      setPasswordDialogTitle("Nytt lösenord");
      setPasswordDialogDescription(`Admin: ${admin.full_name || admin.email}`);
      setPasswordDialogValue(password);
      setPasswordDialogOpen(true);
      setResetDialogOpen(false);
      toast.success("Lösenord återställt");
    } catch (err: any) {
      toast.error(err.message || "Kunde inte återställa lösenord");
    } finally {
      setLoadingAdmins(false);
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
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              Systemadministration
            </span>
            <h1 className="text-3xl font-semibold">Super Admin</h1>
            <p className="text-sm text-slate-400">Hantera företag, admins och operativa inställningar.</p>
          </div>
          <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30">
                <Plus className="h-4 w-4 mr-2" />
                Nytt företag
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-950 text-slate-100 border-slate-800">
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
          <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.6)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Totalt antal företag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-semibold">{companies.length}</span>
                  <p className="text-xs text-slate-400">Aktiva kunder i systemet</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100 shadow-[0_20px_60px_-40px_rgba(34,197,94,0.5)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Totalt antal användare</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-semibold">{companies.reduce((sum, c) => sum + (c.user_count || 0), 0)}</span>
                  <p className="text-xs text-slate-400">Inkluderar admins och användare</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100 shadow-[0_20px_60px_-40px_rgba(129,140,248,0.5)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Skapade sista veckan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-semibold">
                    {companies.filter((c) => c.created_at && new Date(c.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                  </span>
                  <p className="text-xs text-slate-400">Nya bolag senaste 7 dagarna</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100">
          <CardHeader>
            <CardTitle>Alla företag</CardTitle>
            <CardDescription className="text-slate-400">Hantera företag och tillhörande admins</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="text-slate-200">
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Företag</TableHead>
                  <TableHead className="text-slate-400">Faktura-email</TableHead>
                  <TableHead className="text-slate-400">Kod</TableHead>
                  <TableHead className="text-slate-400">Användare</TableHead>
                  <TableHead className="text-slate-400">Skapat</TableHead>
                  <TableHead className="text-slate-400">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} className="border-slate-800">
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-sm text-slate-400">{company.billing_email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-slate-800/70 px-2 py-1 rounded text-slate-200">{company.code || "—"}</code>
                        {company.code && (
                          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-100" onClick={() => copyCode(company.code!)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{company.user_count || 0}</TableCell>
                    <TableCell>{company.created_at ? new Date(company.created_at).toLocaleDateString("sv-SE") : "-"}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" className="border-slate-700 text-slate-200 hover:text-slate-900" onClick={() => setEditingCompany(company)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Redigera
                      </Button>
                      <Button variant="outline" size="sm" className="border-rose-500/50 text-rose-300 hover:text-rose-700" onClick={() => deleteCompany(company.id, company.name)}>
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
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800">
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
              <div className="space-y-2">
                <Label>Företagsadmin</Label>
                {loadingAdmins ? (
                  <p className="text-sm text-slate-400">Laddar admin-användare...</p>
                ) : adminUsers.length === 0 ? (
                  <p className="text-sm text-slate-400">Inga admin-användare hittades.</p>
                ) : (
                  <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUsers.map((admin) => (
                        <SelectItem key={admin.id} value={String(admin.id)}>
                          {admin.full_name || admin.email}
                          {admin.is_active === 0 ? " (Inaktiv)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Admin namn</Label>
                  <Input
                    value={adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.full_name || ""}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin e-post</Label>
                  <Input
                    value={adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.email || ""}
                    readOnly
                  />
                </div>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => setResetDialogOpen(true)}
                  disabled={!selectedAdminId || loadingAdmins}
                >
                  Återställ lösenord
                </Button>
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

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
          <DialogHeader>
            <DialogTitle>Återställ lösenord</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">
            Generera ett nytt lösenord för{" "}
            {adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.full_name ||
              adminUsers.find((u) => String(u.id) === String(selectedAdminId))?.email}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleResetAdminPassword} disabled={loadingAdmins || !selectedAdminId}>
              {loadingAdmins ? "Genererar..." : "Generera nytt lösenord"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (open) setPasswordDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md [&>button]:hidden bg-slate-950 text-slate-100 border-slate-800">
          <DialogHeader>
            <DialogTitle>{passwordDialogTitle}</DialogTitle>
            <DialogDescription>{passwordDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="generated-password">Genererat lösenord</Label>
            <Input id="generated-password" value={passwordDialogValue} readOnly className="font-mono" />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setPasswordDialogOpen(false);
                setPasswordDialogValue("");
                setPasswordDialogDescription("");
                setPasswordDialogTitle("");
              }}
            >
              Jag har sparat lösenord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-800/80 bg-slate-900/70 text-slate-100">
        <CardHeader>
          <CardTitle>AI-felsökare</CardTitle>
          <CardDescription className="text-slate-400">Klistra in felkod/logg för snabb hjälp (endast Super Admin).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-56 rounded-md border border-slate-800 bg-slate-950/60">
            <div className="space-y-3 p-3">
              {aiMessages.length === 0 && (
                <p className="text-sm text-slate-400">
                  Ingen historik ännu. Lägg in en felkod eller beskrivning.
                </p>
              )}
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-md bg-slate-900/80 p-3 shadow-sm">
                  <p className="text-xs uppercase text-slate-500">
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
            <p className="text-xs text-slate-400">
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
    </div>
  );
};

export default SuperAdminDashboard;
