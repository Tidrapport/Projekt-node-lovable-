import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building2, Copy, Check, Users, Upload, X, ImageIcon } from "lucide-react";

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  company_code: string;
  logo_url: string | null;
  created_at: string;
  user_count: number;
}

const AdminHub = () => {
  const { company, companyId } = useAuth();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (companyId) {
      fetchCompanyInfo();
    }
  }, [companyId]);

  const fetchCompanyInfo = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;

      // Fetch user count for this company
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      setCompanyInfo({
        ...companyData,
        user_count: count || 0,
      } as CompanyInfo);
    } catch (error: any) {
      console.error("Error fetching company info:", error);
      toast.error("Kunde inte hämta företagsinformation");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Företags-ID kopierat!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Kunde inte kopiera");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Endast bildfiler är tillåtna");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Bilden får vara max 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `company-logos/${companyId}/logo.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName);

      // Add cache buster to URL
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update company record
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: logoUrl })
        .eq("id", companyId);

      if (updateError) throw updateError;

      // Update local state
      setCompanyInfo((prev) =>
        prev ? { ...prev, logo_url: logoUrl } : null
      );
      toast.success("Logotyp uppdaterad!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error("Kunde inte ladda upp logotyp");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!companyId) return;

    setUploadingLogo(true);
    try {
      // Update company record to remove logo URL
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: null })
        .eq("id", companyId);

      if (updateError) throw updateError;

      // Update local state
      setCompanyInfo((prev) =>
        prev ? { ...prev, logo_url: null } : null
      );
      toast.success("Logotyp borttagen");
    } catch (error: any) {
      console.error("Error removing logo:", error);
      toast.error("Kunde inte ta bort logotyp");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AdminHub</h1>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!companyInfo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AdminHub</h1>
          <p className="text-muted-foreground">
            Inget företag kopplat till ditt konto
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AdminHub</h1>
        <p className="text-muted-foreground">
          Hantera ditt företag och bjud in användare
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {companyInfo.name}
          </CardTitle>
          <CardDescription>
            Din företagsinformation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Logo Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Företagslogotyp</h3>
                <p className="text-sm text-muted-foreground">
                  Visas på inloggningssidan för dina anställda
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                {companyInfo.logo_url ? (
                  <img 
                    src={companyInfo.logo_url} 
                    alt={companyInfo.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? "Laddar upp..." : companyInfo.logo_url ? "Byt logotyp" : "Ladda upp logotyp"}
                </Button>
                {companyInfo.logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Ta bort
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Max 2MB, PNG/JPG/SVG
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Företagsnamn</p>
              <p className="font-medium">{companyInfo.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Slug</p>
              <Badge variant="secondary">{companyInfo.slug}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Antal användare</p>
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {companyInfo.user_count}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Registrerad</p>
              <p className="font-medium">
                {new Date(companyInfo.created_at).toLocaleDateString("sv-SE")}
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-2">Företags-ID för inbjudningar</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Dela detta ID med anställda så de kan registrera sig och kopplas till ditt företag
            </p>
            <div className="flex items-center gap-3">
              <code className="bg-muted px-4 py-2 rounded text-lg font-mono">
                {companyInfo.company_code}
              </code>
              <Button
                variant="outline"
                onClick={() => copyToClipboard(companyInfo.company_code)}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Kopierat
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Kopiera
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Hur du bjuder in användare
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Alternativ 1: Manuell registrering</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Kopiera företags-ID:t ovan</li>
              <li>Skicka det till den anställde (via e-post, SMS, etc.)</li>
              <li>Den anställde går till inloggningssidan och väljer "Skapa konto"</li>
              <li>De anger företags-ID:t tillsammans med sina uppgifter</li>
              <li>Kontot skapas och kopplas automatiskt till ditt företag</li>
            </ol>
          </div>
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-semibold">Alternativ 2: Admin skapar konto</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Gå till Admin → Användare</li>
              <li>Klicka på "Lägg till användare"</li>
              <li>Fyll i namn, e-post och övriga uppgifter</li>
              <li>Användaren får ett e-postmeddelande för att aktivera sitt konto</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHub;
