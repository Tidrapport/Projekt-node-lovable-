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
import { Shield, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Super admin emails that can bypass company verification
const SUPER_ADMIN_EMAILS = ["ai@railwork.se"];

// LocalStorage key and expiry (1 year in milliseconds)
const COMPANY_CODE_STORAGE_KEY = "saved_company_code";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface SavedCompanyCode {
  code: string;
  savedAt: number;
}

interface CompanyOption {
  id: string;
  name: string;
  company_code: string;
  code?: string | null;
  logo_url: string | null;
  abbreviation: string;
}

// Generate abbreviation from company name (e.g., "Rail Work AB" -> "RWAB")
const generateAbbreviation = (name: string): string => {
  const words = name.split(/\s+/).filter(word => word.length > 0);
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

const Auth = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Super admin mode
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  
  // Company list and selection
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState("");
  const [verifiedCompany, setVerifiedCompany] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);

  // Load companies and saved company code on mount
  useEffect(() => {
    const loadCompaniesAndSavedCode = async () => {
      try {
        // Fetch public companies endpoint
        const companiesData = await apiFetch<any[]>("/public/companies");

        const companiesWithAbbr = (companiesData || []).map(company => ({
          ...company,
          company_code: company.company_code || company.code || "",
          abbreviation: generateAbbreviation(company.name)
        }));
        setCompanies(companiesWithAbbr);

        // Check for saved company code
        const saved = localStorage.getItem(COMPANY_CODE_STORAGE_KEY);
        if (saved) {
          const parsedData: SavedCompanyCode = JSON.parse(saved);
          const now = Date.now();
          
          if (now - parsedData.savedAt < ONE_YEAR_MS) {
            setSelectedCompanyCode(parsedData.code);
            // Auto-verify the saved company code
            await autoVerifyCompanyCode(parsedData.code);
          } else {
            localStorage.removeItem(COMPANY_CODE_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("Error loading companies:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadCompaniesAndSavedCode();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === "super_admin" ? "/superadmin" : "/");
    }
  }, [user, navigate]);

  const getCompanyCode = (company: CompanyOption) => (company.company_code || company.code || "").toUpperCase();

  const autoVerifyCompanyCode = async (code: string) => {
    try {
      const codeUp = code.toUpperCase();
      const found = (companies || []).find((c) => getCompanyCode(c) === codeUp);
      if (found) {
        setVerifiedCompany({ id: found.id, name: found.name, logo_url: found.logo_url });
      } else {
        localStorage.removeItem(COMPANY_CODE_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error auto-verifying company:", error);
      localStorage.removeItem(COMPANY_CODE_STORAGE_KEY);
    }
  };

  const saveCompanyCode = (code: string) => {
    const dataToSave: SavedCompanyCode = {
      code: code.toUpperCase(),
      savedAt: Date.now(),
    };
    localStorage.setItem(COMPANY_CODE_STORAGE_KEY, JSON.stringify(dataToSave));
  };

  const handleCompanySelect = (code: string) => {
    setSelectedCompanyCode(code);
    const company = companies.find(c => getCompanyCode(c) === code.toUpperCase());
    if (company) {
      setVerifiedCompany({ id: company.id, name: company.name, logo_url: company.logo_url });
      saveCompanyCode(code);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Fyll i alla fält");
      return;
    }

    // Super admin can bypass company verification
    const requireCompanyCheck = !isSuperAdminMode && companies.length > 0;

    if (requireCompanyCheck && !verifiedCompany) {
      toast.error("Verifiera företags-ID först");
      return;
    }

    setLoading(true);
    try {
      const companyId = verifiedCompany?.id ? Number(verifiedCompany.id) : undefined;

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
    setVerifiedCompany(null);
    setEmail("");
    setPassword("");
    setSelectedCompanyCode("");
  };

  const toggleSuperAdminMode = () => {
    setIsSuperAdminMode(!isSuperAdminMode);
    setVerifiedCompany(null);
    setSelectedCompanyCode("");
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
              {!verifiedCompany 
                ? "Välj ditt företag för att fortsätta" 
                : `Logga in till ${verifiedCompany.name}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-select">Välj företag</Label>
                <Select value={selectedCompanyCode} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="company-select" disabled={loading}>
                    <SelectValue placeholder="Välj ditt företag" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {companies.map((company) => (
                      <SelectItem key={getCompanyCode(company)} value={getCompanyCode(company)}>
                        <span className="flex items-center gap-2">
                          <span>{company.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">({company.abbreviation})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Kontakta din administratör om ditt företag inte visas</span>
                  {verifiedCompany && (
                    <Button type="button" variant="ghost" size="sm" onClick={resetCompanyVerification}>
                      Rensa val
                    </Button>
                  )}
                </div>
              </div>

              {verifiedCompany && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Inloggning till</p>
                  <p className="font-medium">{verifiedCompany.name}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.se"
                  required
                  disabled={loading}
                />
              </div>

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
                disabled={loading || (companies.length > 0 && !verifiedCompany)}
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
