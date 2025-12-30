import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/api/client";
import { getMe } from "@/api/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CompanyOption {
  id: string;
  name: string;
  code?: string | null;
  logo_url: string | null;
}

const Auth = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Super admin mode
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  
  // Company lookup by email
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [checkingCompanies, setCheckingCompanies] = useState(false);
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);

  useEffect(() => {
    setInitialLoading(false);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === "super_admin" ? "/superadmin" : "/");
    }
  }, [user, navigate]);

  const fetchCompanyOptions = async (lookupEmail: string) => {
    const cleanEmail = lookupEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setCompanyOptions([]);
      setSelectedCompanyId("");
      return [];
    }
    setCheckingCompanies(true);
    try {
      const res = await apiFetch<{ companies: CompanyOption[] }>("/auth/company-options", {
        method: "POST",
        json: { email: cleanEmail },
      });
      const options = res?.companies || [];
      setCompanyOptions(options);
      if (options.length === 1) {
        setSelectedCompanyId(String(options[0].id));
      } else if (options.length === 0) {
        setSelectedCompanyId("");
      } else if (!options.some((opt) => String(opt.id) === String(selectedCompanyId))) {
        setSelectedCompanyId("");
      }
      return options;
    } catch (error) {
      console.error("Error fetching company options:", error);
      setCompanyOptions([]);
      setSelectedCompanyId("");
      return [];
    } finally {
      setCheckingCompanies(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Fyll i alla fält");
      return;
    }

    let options = companyOptions;
    if (!isSuperAdminMode) {
      if (companyOptions.length === 0) {
        options = await fetchCompanyOptions(email.trim());
      }
      if (options.length > 1 && !selectedCompanyId) {
        toast.error("Välj företag för denna e-post");
        return;
      }
    }

    setLoading(true);
    try {
      const companyId =
        !isSuperAdminMode && options.length > 0
          ? Number((options.length > 1 ? selectedCompanyId : options[0].id))
          : undefined;

      // Use Auth context to login (stores token)
      await login(email.trim(), password, companyId);
      const me = await getMe();
      toast.success("Inloggad!");
      navigate(me?.user?.role === "super_admin" ? "/superadmin" : "/");
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.message === "Invalid login credentials") {
        toast.error("Fel e-post eller lösenord");
      } else {
        toast.error(error.message || "Kunde inte logga in");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetCompanyVerification = () => {
    setCompanyOptions([]);
    setSelectedCompanyId("");
  };

  const toggleSuperAdminMode = () => {
    setIsSuperAdminMode(!isSuperAdminMode);
    setCompanyOptions([]);
    setSelectedCompanyId("");
    setEmail("");
    setPassword("");
  };

  // Show loading while checking for saved company code
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2 text-slate-100">
            <img
              src="/opero-systems-logo.png"
              alt="Opero Systems AB"
              className="h-24 mx-auto object-contain"
            />
            <p className="text-slate-300">Laddar...</p>
          </div>
        </div>
      </div>
    );
  }

  // Super admin login form
  if (isSuperAdminMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2 text-slate-100">
            <img
              src="/opero-systems-logo.png"
              alt="Opero Systems AB"
              className="h-24 mx-auto object-contain"
            />
            <p className="text-slate-300">Systemadministratör</p>
          </div>

          <Card className="shadow-elevated border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Super Admin
              </CardTitle>
              <CardDescription>
                Logga in utan företags-ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">E-post</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Lösenord</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loggar in..." : "Logga in som admin"}
                </Button>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={toggleSuperAdminMode}
                >
                  ← Tillbaka till vanlig inloggning
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6">

        <Card className="shadow-elevated">
          <CardHeader className="space-y-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <img
                src="/opero-systems-logo.png"
                alt="Opero Systems AB"
                className="h-28 mx-auto object-contain rounded-md bg-slate-950 p-2"
              />
              <p className="text-sm text-muted-foreground">Företags operativsystem</p>
            </div>
            <CardTitle className="text-center">Välkommen</CardTitle>
            <CardDescription className="text-center">
              Logga in med din e-postadress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (companyOptions.length > 0) {
                      setCompanyOptions([]);
                      setSelectedCompanyId("");
                    }
                  }}
                  onBlur={() => {
                    if (!isSuperAdminMode) {
                      fetchCompanyOptions(email);
                    }
                  }}
                  placeholder="din@epost.se"
                  required
                  disabled={loading}
                />
              </div>

              {!isSuperAdminMode && companyOptions.length === 1 && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Inloggning till</p>
                  <p className="font-medium">{companyOptions[0].name}</p>
                </div>
              )}

              {!isSuperAdminMode && companyOptions.length > 1 && (
                <div className="space-y-2">
                  <Label>Välj företag</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger disabled={loading || checkingCompanies}>
                      <SelectValue placeholder="Välj företag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {companyOptions.map((company) => (
                        <SelectItem key={company.id} value={String(company.id)}>
                          <span>{company.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Fler än ett företag hittades för denna e-post</span>
                    <Button type="button" variant="ghost" size="sm" onClick={resetCompanyVerification}>
                      Rensa val
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Lösenord</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => setForgotDialogOpen(true)}
                  >
                    Glömt lösenord?
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary"
                disabled={loading || (companyOptions.length > 1 && !selectedCompanyId)}
              >
                {loading ? "Loggar in..." : "Logga in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Dialog open={forgotDialogOpen} onOpenChange={setForgotDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Glömt lösenord</DialogTitle>
              <DialogDescription>Kontakta din chef för att få ett nytt lösenord.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setForgotDialogOpen(false)}>
                Stäng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Hidden super admin access */}
        <div className="text-center">
          <Button 
            variant="link" 
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
            onClick={toggleSuperAdminMode}
          >
            Systemadministratör
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
