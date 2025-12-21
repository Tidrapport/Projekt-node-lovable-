import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users as UsersIcon, Shield, User, DollarSign, Phone, UserPlus, Copy, Key, Eye, EyeOff, Pencil } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { COMMON_TAX_TABLES } from "@/lib/taxCalculations";

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  hourly_wage: number;
  tax_table: number;
  phone: string | null;
  emergency_contact: string | null;
  employee_type: 'anställd' | 'platschef' | 'inhyrd' | null;
  employee_number: string | null;
  user_roles: Array<{ role: string }>;
}

const EMPLOYEE_TYPES = [
  { value: 'anställd', label: 'Anställd' },
  { value: 'platschef', label: 'Platschef' },
  { value: 'inhyrd', label: 'Inhyrd' },
];

const AdminUsers = () => {
  const { companyId } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [hourlyWage, setHourlyWage] = useState<string>("");
  const [taxTable, setTaxTable] = useState<string>("30");
  
  // New user form state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserEmergencyContact, setNewUserEmergencyContact] = useState("");
  const [newUserEmployeeType, setNewUserEmployeeType] = useState<string>("anställd");
  const [newUserEmployeeNumber, setNewUserEmployeeNumber] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Generated password display state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [createdUserName, setCreatedUserName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Reset password state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordUserName, setResetPasswordUserName] = useState("");
  const [newGeneratedPassword, setNewGeneratedPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  
  // Edit profile state
  const [editProfileUserId, setEditProfileUserId] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileEmergency, setEditProfileEmergency] = useState("");
  const [editProfileEmployeeType, setEditProfileEmployeeType] = useState<string>("anställd");
  const [editProfileEmployeeNumber, setEditProfileEmployeeNumber] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchUsers();
    }
  }, [companyId]);

  const fetchUsers = async () => {
    let query = supabase
      .from("profiles")
      .select(`
        *,
        user_roles(role)
      `)
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setUsers(data as UserProfile[]);
    }
  };

  const toggleAdminRole = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Admin-rättigheter borttagna");
        fetchUsers();
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
        });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Admin-rättigheter tillagda");
        fetchUsers();
      }
    }
  };

  const updateHourlyWage = async (userId: string) => {
    const wage = parseFloat(hourlyWage);
    const tax = parseInt(taxTable);
    
    if (isNaN(wage) || wage < 0) {
      toast.error("Ange en giltig timlön");
      return;
    }

    if (isNaN(tax) || tax < 0 || tax > 100) {
      toast.error("Ange en giltig skattetabell");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ 
        hourly_wage: wage,
        tax_table: tax
      })
      .eq("id", userId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Timlön och skattetabell uppdaterad");
      setEditingUserId(null);
      fetchUsers();
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setEditingUserId(user.id);
    setHourlyWage(user.hourly_wage?.toString() || "0");
    setTaxTable(user.tax_table?.toString() || "30");
  };

  const resetNewUserForm = () => {
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPhone("");
    setNewUserEmergencyContact("");
    setNewUserEmployeeType("anställd");
    setNewUserEmployeeNumber("");
  };

  const generateSecurePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure at least one uppercase, one lowercase, one number
    password += 'Aa1';
    return password;
  };

  const createNewUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast.error("Namn och e-post är obligatoriska");
      return;
    }

    if (!companyId) {
      toast.error("Inget företag kopplat");
      return;
    }

    setIsCreating(true);

    try {
      // Generate a secure password
      const tempPassword = generateSecurePassword();
      
      const redirectUrl = `${window.location.origin}/`;
      
      // Create the user via backend API
      try {
        const authResp = await apiFetch("/admin/users", {
          method: "POST",
          json: {
            email: newUserEmail.trim(),
            password: tempPassword,
            full_name: newUserName.trim(),
            company_id: companyId,
            phone: newUserPhone.trim() || null,
            emergency_contact: newUserEmergencyContact.trim() || null,
            employee_type: newUserEmployeeType,
            employee_number: newUserEmployeeNumber.trim() || null,
            redirectTo: redirectUrl,
          },
        });

        // Show the generated password to admin
        setGeneratedPassword(tempPassword);
        setCreatedUserName(newUserName.trim());
        setShowPasswordDialog(true);

        resetNewUserForm();
        setIsAddDialogOpen(false);
        fetchUsers();
      } catch (err: any) {
        throw err;
      }
    } catch (error: any) {
      console.error("Create user error:", error);
      if (error.message?.includes("already registered")) {
        toast.error("E-postadressen är redan registrerad");
      } else {
        toast.error(error.message || "Kunde inte skapa användare");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword || newGeneratedPassword);
    toast.success("Lösenord kopierat!");
  };

  const openResetPasswordDialog = (userId: string, userName: string) => {
    setResetPasswordUserId(userId);
    setResetPasswordUserName(userName);
    setNewGeneratedPassword("");
    setShowPassword(false);
  };

  const resetUserPassword = async () => {
    if (!resetPasswordUserId) return;
    
    setIsResetting(true);
    try {
      const newPassword = generateSecurePassword();
      
      // Call edge function to reset password
      const session = { access_token: localStorage.getItem("access_token") };
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            userId: resetPasswordUserId,
            newPassword: newPassword,
          }),
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }
      
      setNewGeneratedPassword(newPassword);
      toast.success("Lösenord återställt!");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error(error.message || "Kunde inte återställa lösenord");
    } finally {
      setIsResetting(false);
    }
  };

  const getEmployeeTypeLabel = (type: string | null) => {
    const found = EMPLOYEE_TYPES.find(t => t.value === type);
    return found?.label || 'Anställd';
  };

  const getEmployeeTypeBadgeVariant = (type: string | null) => {
    switch (type) {
      case 'platschef':
        return 'default';
      case 'inhyrd':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const openEditProfileDialog = (user: UserProfile) => {
    setEditProfileUserId(user.id);
    setEditProfileName(user.full_name || "");
    setEditProfileEmail(user.email || "");
    setEditProfilePhone(user.phone || "");
    setEditProfileEmergency(user.emergency_contact || "");
    setEditProfileEmployeeType(user.employee_type || "anställd");
    setEditProfileEmployeeNumber(user.employee_number || "");
  };

  const saveProfile = async () => {
    if (!editProfileUserId || !editProfileName.trim()) {
      toast.error("Namn är obligatoriskt");
      return;
    }

    setIsSavingProfile(true);
    try {
      // Update profile in profiles table
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editProfileName.trim(),
          email: editProfileEmail.trim() || null,
          phone: editProfilePhone.trim() || null,
          emergency_contact: editProfileEmergency.trim() || null,
          employee_type: editProfileEmployeeType as 'anställd' | 'platschef' | 'inhyrd',
          employee_number: editProfileEmployeeNumber.trim() || null,
        })
        .eq("id", editProfileUserId);

      if (error) throw error;

      // Also update auth email if changed
      if (editProfileEmail.trim()) {
        const session = { access_token: localStorage.getItem("access_token") };
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              userId: editProfileUserId,
              newEmail: editProfileEmail.trim(),
            }),
          }
        );
        
        if (!response.ok) {
          const result = await response.json();
          console.error("Email update warning:", result.error);
          // Don't fail the whole operation if email update fails
        }
      }

      toast.success("Profil uppdaterad");
      setEditProfileUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara profil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold font-heading">Användare</h2>
          <p className="text-muted-foreground">Hantera användare och roller</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Lägg till användare
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Lägg till ny användare</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Namn *</Label>
                <Input
                  id="new-name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Förnamn Efternamn"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-email">E-post *</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="exempel@foretag.se"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-phone">Telefonnummer</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="070-123 45 67"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-emergency">Närmast anhörig</Label>
                <Input
                  id="new-emergency"
                  value={newUserEmergencyContact}
                  onChange={(e) => setNewUserEmergencyContact(e.target.value)}
                  placeholder="Namn, telefon"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-type">Typ av anställning</Label>
                <Select value={newUserEmployeeType} onValueChange={setNewUserEmployeeType}>
                  <SelectTrigger id="new-type">
                    <SelectValue placeholder="Välj typ" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-employee-number">Anställningsnummer</Label>
                <Input
                  id="new-employee-number"
                  value={newUserEmployeeNumber}
                  onChange={(e) => setNewUserEmployeeNumber(e.target.value)}
                  placeholder="T.ex. 1001"
                />
              </div>
              
              <Button 
                onClick={createNewUser} 
                className="w-full" 
                disabled={isCreating}
              >
                {isCreating ? "Skapar..." : "Skapa användare"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {users.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6 text-center text-muted-foreground">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Inga användare ännu. Klicka på "Lägg till användare" för att börja.</p>
            </CardContent>
          </Card>
        ) : (
          users.map((user) => {
            const isAdmin = user.user_roles.some(r => r.role === "admin");
            
            return (
              <Card key={user.id} className="shadow-card">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {isAdmin ? (
                          <Shield className="h-6 w-6 text-primary" />
                        ) : (
                          <User className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{user.full_name}</h3>
                          <Badge variant={getEmployeeTypeBadgeVariant(user.employee_type)}>
                            {getEmployeeTypeLabel(user.employee_type)}
                          </Badge>
                          {isAdmin && (
                            <Badge className="bg-primary">Admin</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Registrerad {format(new Date(user.created_at), "d MMMM yyyy", { locale: sv })}
                          {user.employee_number && (
                            <span className="ml-2">• Anst.nr: {user.employee_number}</span>
                          )}
                        </p>
                        {user.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    
                      <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>{user.hourly_wage || 0} kr/h (Tabell {user.tax_table || 30})</span>
                      </div>
                      
                      <Button variant="outline" size="sm" onClick={() => openEditProfileDialog(user)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Redigera
                      </Button>
                      
                      <Dialog open={editingUserId === user.id} onOpenChange={(open) => !open && setEditingUserId(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                            Ändra lön & skatt
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Ändra timlön och skattetabell för {user.full_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label htmlFor="hourly-wage">Timlön (kr/h före skatt)</Label>
                              <Input
                                id="hourly-wage"
                                type="number"
                                step="0.01"
                                min="0"
                                value={hourlyWage}
                                onChange={(e) => setHourlyWage(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="tax-table">Skattetabell</Label>
                              <Select value={taxTable} onValueChange={setTaxTable}>
                                <SelectTrigger id="tax-table">
                                  <SelectValue placeholder="Välj skattetabell" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMMON_TAX_TABLES.map((table) => (
                                    <SelectItem key={table.value} value={table.value.toString()}>
                                      {table.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={() => updateHourlyWage(user.id)} className="w-full">
                              Spara
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openResetPasswordDialog(user.id, user.full_name)}
                      >
                        <Key className="h-4 w-4 mr-1" />
                        Återställ lösenord
                      </Button>
                      
                      <Button
                        variant={isAdmin ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleAdminRole(user.id, isAdmin)}
                      >
                        {isAdmin ? "Ta bort admin" : "Gör till admin"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      
      {/* Generated Password Dialog - shown after creating user */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Användare skapad!</DialogTitle>
            <DialogDescription>
              Ge detta lösenord till {createdUserName}. Användaren kan sedan byta till ett eget lösenord.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Genererat lösenord</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={generatedPassword}
                    readOnly
                    className="font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button onClick={copyPassword} variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Instruktioner till användaren:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Logga in med e-post och detta lösenord</li>
                <li>Gå till profil och byt lösenord</li>
                <li>Använd ditt nya lösenord framöver</li>
              </ol>
            </div>
            <Button onClick={() => setShowPasswordDialog(false)} className="w-full">
              Jag har sparat lösenordet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUserId} onOpenChange={(open) => !open && setResetPasswordUserId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Återställ lösenord</DialogTitle>
            <DialogDescription>
              Generera ett nytt lösenord för {resetPasswordUserName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {!newGeneratedPassword ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Detta genererar ett nytt tillfälligt lösenord som du kan ge till användaren.
                  Användaren kan sedan byta till ett eget lösenord.
                </p>
                <Button 
                  onClick={resetUserPassword} 
                  className="w-full"
                  disabled={isResetting}
                >
                  {isResetting ? "Genererar..." : "Generera nytt lösenord"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Nytt lösenord</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newGeneratedPassword}
                        readOnly
                        className="font-mono pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={copyPassword} variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm border border-yellow-200 dark:border-yellow-800">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">OBS!</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Användaren måste logga ut och logga in igen med detta nya lösenord.
                  </p>
                </div>
                <Button onClick={() => setResetPasswordUserId(null)} className="w-full">
                  Klar
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Profile Dialog */}
      <Dialog open={!!editProfileUserId} onOpenChange={(open) => !open && setEditProfileUserId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redigera användare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Namn *</Label>
              <Input
                id="edit-name"
                value={editProfileName}
                onChange={(e) => setEditProfileName(e.target.value)}
                placeholder="Förnamn Efternamn"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-post</Label>
              <Input
                id="edit-email"
                type="email"
                value={editProfileEmail}
                onChange={(e) => setEditProfileEmail(e.target.value)}
                placeholder="exempel@foretag.se"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefonnummer</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editProfilePhone}
                onChange={(e) => setEditProfilePhone(e.target.value)}
                placeholder="070-123 45 67"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-emergency">Närmast anhörig</Label>
              <Input
                id="edit-emergency"
                value={editProfileEmergency}
                onChange={(e) => setEditProfileEmergency(e.target.value)}
                placeholder="Namn, telefon"
              />
            </div>
            
              <div className="space-y-2">
                <Label htmlFor="edit-type">Typ av anställning</Label>
                <Select value={editProfileEmployeeType} onValueChange={setEditProfileEmployeeType}>
                  <SelectTrigger id="edit-type">
                    <SelectValue placeholder="Välj typ" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-employee-number">Anställningsnummer</Label>
                <Input
                  id="edit-employee-number"
                  value={editProfileEmployeeNumber}
                  onChange={(e) => setEditProfileEmployeeNumber(e.target.value)}
                  placeholder="T.ex. 1001"
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditProfileUserId(null)}>
                  Avbryt
                </Button>
                <Button onClick={saveProfile} disabled={isSavingProfile}>
                  {isSavingProfile ? "Sparar..." : "Spara ändringar"}
                </Button>
              </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;