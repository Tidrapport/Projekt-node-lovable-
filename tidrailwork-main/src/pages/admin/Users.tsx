import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users as UsersIcon, Shield, User, Phone, UserPlus, Pencil, Trash2, Key } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

type UserRow = {
  id: string | number;
  email: string;
  role: string;
  company_id: string | number | null;
  is_active?: number | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  hourly_wage?: number | null;
  monthly_salary?: number | null;
  tax_table?: number | null;
  created_at?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  employee_type?: string | null;
  employee_number?: string | null;
};

const roleOptions = [
  { value: "user", label: "Användare" },
  { value: "admin", label: "Admin" },
];

const employeeTypes = [
  { value: "anställd", label: "Anställd" },
  { value: "inhyrd", label: "Inhyrd" },
  { value: "platschef", label: "Platschef" },
];

const AdminUsers = () => {
  const { companyId, isAdmin, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");

  // New user form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmergency, setNewEmergency] = useState("");
  const [newEmployeeType, setNewEmployeeType] = useState<string>("anställd");
  const [newEmployeeNumber, setNewEmployeeNumber] = useState("");
  const [newRole, setNewRole] = useState<string>("user");
  const [newHourlyWage, setNewHourlyWage] = useState("");
  const [newMonthlySalary, setNewMonthlySalary] = useState("");
  const [newTaxTable, setNewTaxTable] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogTitle, setPasswordDialogTitle] = useState("");
  const [passwordDialogDescription, setPasswordDialogDescription] = useState("");
  const [passwordDialogValue, setPasswordDialogValue] = useState("");

  const availableRoles = useMemo(() => {
    if (isAdmin || isSuperAdmin) return roleOptions;
    return roleOptions.filter((role) => role.value === "user");
  }, [isAdmin, isSuperAdmin]);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmergency, setEditEmergency] = useState("");
  const [editEmployeeType, setEditEmployeeType] = useState<string>("anställd");
  const [editEmployeeNumber, setEditEmployeeNumber] = useState("");
  const [editRole, setEditRole] = useState<string>("user");
  const [editHourlyWage, setEditHourlyWage] = useState("");
  const [editMonthlySalary, setEditMonthlySalary] = useState("");
  const [editTaxTable, setEditTaxTable] = useState("");

  const targetCompanyId = useMemo(() => {
    if (isSuperAdmin) return selectedCompanyId;
    return companyId ? String(companyId) : "";
  }, [companyId, isSuperAdmin, selectedCompanyId]);

  const isUserActive = (user: UserRow) => user.is_active === undefined || user.is_active === null || user.is_active === 1;

  const activeUsers = useMemo(() => users.filter((user) => isUserActive(user)), [users]);
  const inactiveUsers = useMemo(() => users.filter((user) => !isUserActive(user)), [users]);

  const fetchUsers = async () => {
    if (!targetCompanyId) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<UserRow[]>(`/admin/users?company_id=${targetCompanyId}&include_inactive=1`);
      setUsers(data || []);
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta användare");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const companies = await apiFetch<{ id: string; name: string; code?: string | null }[]>("/companies");
        setCompanyOptions(companies || []);
        if (!selectedCompanyId && companies && companies.length) {
          setSelectedCompanyId(String(companies[0].id));
        }
      } catch (err: any) {
        toast.error(err.message || "Kunde inte hämta företag");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && targetCompanyId) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCompanyId, isSuperAdmin]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd + "Aa1";
  };

  const splitName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "-" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Namn och e-post är obligatoriska");
      return;
    }
    if (!targetCompanyId) {
      toast.error("Välj ett företag först");
      return;
    }
    const password = generatePassword();
    const { first, last } = splitName(newName);
    setLoading(true);
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        json: {
          first_name: first,
          last_name: last,
          email: newEmail.trim(),
          phone: newPhone.trim() || null,
          emergency_contact: newEmergency.trim() || null,
          employee_type: newEmployeeType,
          employee_number: newEmployeeNumber.trim() || null,
          role: newRole,
          password,
          company_id: Number(targetCompanyId),
          hourly_wage: newHourlyWage ? Number(newHourlyWage) : null,
          monthly_salary: newMonthlySalary ? Number(newMonthlySalary) : null,
          tax_table: newTaxTable ? Number(newTaxTable) : null,
        },
      });
      setGeneratedPassword(password);
      setPasswordDialogTitle("Tillfälligt lösenord");
      setPasswordDialogDescription(`Användare: ${newName.trim() || newEmail.trim()}`);
      setPasswordDialogValue(password);
      setPasswordDialogOpen(true);
      toast.success("Användare skapad");
      setIsAddDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewEmergency("");
      setNewEmployeeType("anställd");
      setNewEmployeeNumber("");
      setNewRole("user");
      setNewHourlyWage("");
      setNewMonthlySalary("");
      setNewTaxTable("");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte skapa användare");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditName(user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim());
    setEditEmail(user.email || "");
    setEditPhone(user.phone || "");
    setEditEmergency(user.emergency_contact || "");
    setEditEmployeeType(user.employee_type || "anställd");
    setEditEmployeeNumber(user.employee_number || "");
    setEditRole((user.role || "user").toLowerCase());
    setEditHourlyWage(user.hourly_wage != null ? String(user.hourly_wage) : "");
    setEditMonthlySalary(user.monthly_salary != null ? String(user.monthly_salary) : "");
    setEditTaxTable(user.tax_table != null ? String(user.tax_table) : "");
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    if (!editName.trim()) {
      toast.error("Namn är obligatoriskt");
      return;
    }
    const { first, last } = splitName(editName);
    setLoading(true);
    try {
      await apiFetch(`/admin/users/${editingUser.id}`, {
        method: "PUT",
        json: {
          first_name: first,
          last_name: last,
          phone: editPhone.trim() || null,
          role: editRole,
          hourly_wage: editHourlyWage ? Number(editHourlyWage) : null,
          monthly_salary: editMonthlySalary ? Number(editMonthlySalary) : null,
          emergency_contact: editEmergency.trim() || null,
          employee_type: editEmployeeType,
          employee_number: editEmployeeNumber.trim() || null,
          tax_table: editTaxTable ? Number(editTaxTable) : null,
        },
      });
      toast.success("Användare uppdaterad");
      setIsEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte uppdatera användare");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string | number) => {
    try {
      await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
      toast.success("Användare avaktiverad");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte avaktivera användare");
    }
  };

  const handleReactivate = async (userId: string | number) => {
    try {
      await apiFetch(`/admin/users/${userId}/reactivate`, { method: "POST" });
      toast.success("Användare aktiverad");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte aktivera användare");
    }
  };

  const handleResetPassword = async (user: UserRow) => {
    const pwd = generatePassword();
    setLoading(true);
    try {
      await apiFetch(`/admin/users/${user.id}/reset-password`, {
        method: "POST",
        json: { password: pwd },
      });
      setPasswordDialogTitle("Nytt lösenord");
      setPasswordDialogDescription(`Användare: ${user.full_name || user.email}`);
      setPasswordDialogValue(pwd);
      setPasswordDialogOpen(true);
      toast.success("Lösenord återställt");
      setGeneratedPassword(pwd);
      setResetUser(null);
      setIsResetDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Kunde inte återställa lösenord");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold font-heading">Användare</h2>
          <p className="text-muted-foreground">Hantera användare och roller</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isSuperAdmin && (
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Företag</Label>
              <Select value={targetCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="sm:min-w-[240px]">
                  <SelectValue placeholder="Välj företag" />
                </SelectTrigger>
                <SelectContent>
                  {companyOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        {c.code && <span className="text-xs text-muted-foreground">Kod: {c.code}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Lägg till användare
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ny användare</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Namn *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Förnamn Efternamn" />
                </div>
                <div className="space-y-2">
                  <Label>E-post *</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="exempel@foretag.se" />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="070-123 45 67" />
                </div>
                <div className="space-y-2">
                  <Label>Närmast anhörig</Label>
                  <Input value={newEmergency} onChange={(e) => setNewEmergency(e.target.value)} placeholder="Namn, telefon" />
                </div>
                <div className="space-y-2">
                  <Label>Typ av anställning</Label>
                  <Select value={newEmployeeType} onValueChange={setNewEmployeeType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj typ" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Anställningsnummer</Label>
                  <Input value={newEmployeeNumber} onChange={(e) => setNewEmployeeNumber(e.target.value)} placeholder="T.ex. 1001" />
                </div>
                <div className="space-y-2">
                  <Label>Timlön (kr/h)</Label>
                  <Input type="number" value={newHourlyWage} onChange={(e) => setNewHourlyWage(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Fast månadslön (kr)</Label>
                  <Input type="number" value={newMonthlySalary} onChange={(e) => setNewMonthlySalary(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Skattetabell</Label>
                  <Input type="number" value={newTaxTable} onChange={(e) => setNewTaxTable(e.target.value)} placeholder="t.ex. 30" />
                </div>
                <div className="space-y-2">
                  <Label>Roll</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj roll" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>Företag</Label>
                    <Select value={targetCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj företag" />
                      </SelectTrigger>
                      <SelectContent>
                        {companyOptions.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} {c.code ? `(${c.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} className="w-full" disabled={loading}>
                  {loading ? "Skapar..." : "Skapa användare"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === "active" ? "default" : "outline"}
            onClick={() => setActiveTab("active")}
          >
            Aktiva ({activeUsers.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "inactive" ? "default" : "outline"}
            onClick={() => setActiveTab("inactive")}
          >
            Avaktiverade ({inactiveUsers.length})
          </Button>
        </div>
        {users.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6 text-center text-muted-foreground">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Inga användare ännu. Klicka på "Lägg till användare" för att börja.</p>
            </CardContent>
          </Card>
        ) : (
          ((activeTab === "active" ? activeUsers : inactiveUsers).length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{activeTab === "active" ? "Inga aktiva användare." : "Inga avaktiverade användare."}</p>
              </CardContent>
            </Card>
          ) : (
            (activeTab === "active" ? activeUsers : inactiveUsers).map((user) => {
            const inactive = !isUserActive(user);
            const isAdmin = (user.role || "").toLowerCase() === "admin" || (user.role || "").toLowerCase() === "super_admin";
            return (
              <Card key={user.id} className="shadow-card">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {isAdmin ? <Shield className="h-6 w-6 text-primary" /> : <User className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{user.full_name || user.email || "Avaktiverad användare"}</h3>
                          <Badge variant={isAdmin ? "default" : "outline"}>{isAdmin ? "Admin" : "User"}</Badge>
                          {user.employee_type && <Badge variant="secondary">{user.employee_type}</Badge>}
                          {user.employee_number && <Badge variant="outline">#{user.employee_number}</Badge>}
                          {inactive && <Badge variant="secondary">Avaktiverad</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {user.created_at ? `Registrerad ${format(new Date(user.created_at), "d MMMM yyyy", { locale: sv })}` : "Registrerad"}
                        </p>
                        <div className="text-sm text-muted-foreground flex flex-col gap-1 mt-1">
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </span>
                          )}
                          {user.emergency_contact && <span>Närmast anhörig: {user.emergency_contact}</span>}
                          {user.hourly_wage != null && <span>Timlön: {user.hourly_wage} kr/h</span>}
                          {user.monthly_salary != null && <span>Månadslön: {user.monthly_salary} kr</span>}
                          {user.tax_table != null && <span>Skattetabell: {user.tax_table}</span>}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const isPrivileged = (user.role || "").toLowerCase() === "super_admin";
                      const canManageUser = isSuperAdmin || !isPrivileged;
                      if (!canManageUser) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Redigera
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setResetUser(user);
                              setIsResetDialogOpen(true);
                            }}
                          >
                            <Key className="h-4 w-4 mr-1" />
                            Återställ lösenord
                          </Button>
                          {inactive ? (
                            <Button variant="outline" size="sm" onClick={() => handleReactivate(user.id)}>
                              Aktivera
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Avaktivera
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            );
            })
          ))
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redigera användare</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label>Namn *</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Label>E-post</Label>
            <Input value={editEmail} disabled />
            <Label>Telefon</Label>
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Label>Närmast anhörig</Label>
            <Input value={editEmergency} onChange={(e) => setEditEmergency(e.target.value)} />
            <Label>Typ av anställning</Label>
            <Select value={editEmployeeType} onValueChange={setEditEmployeeType}>
              <SelectTrigger>
                <SelectValue placeholder="Välj typ" />
              </SelectTrigger>
              <SelectContent>
                {employeeTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Anställningsnummer</Label>
            <Input value={editEmployeeNumber} onChange={(e) => setEditEmployeeNumber(e.target.value)} />
            <Label>Timlön (kr/h)</Label>
            <Input type="number" value={editHourlyWage} onChange={(e) => setEditHourlyWage(e.target.value)} />
            <Label>Fast månadslön (kr)</Label>
            <Input type="number" value={editMonthlySalary} onChange={(e) => setEditMonthlySalary(e.target.value)} />
            <Label>Skattetabell</Label>
            <Input type="number" value={editTaxTable} onChange={(e) => setEditTaxTable(e.target.value)} />
            <Label>Roll</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger>
                <SelectValue placeholder="Välj roll" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "Sparar..." : "Spara ändringar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Återställ lösenord</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Generera ett nytt lösenord för {resetUser?.full_name || resetUser?.email}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={() => resetUser && handleResetPassword(resetUser)} disabled={loading}>
              {loading ? "Genererar..." : "Generera nytt lösenord"}
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
        <DialogContent className="sm:max-w-md [&>button]:hidden">
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
    </div>
  );
};

export default AdminUsers;
