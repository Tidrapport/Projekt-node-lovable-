import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building2, Copy, Check, Users } from "lucide-react";

interface CompanyInfo {
  id: string;
  name: string;
  code?: string | null;
  created_at?: string | null;
  user_count: number;
}

type CompanyInvoiceForm = {
  billing_email: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  bankgiro: string;
  bic_number: string;
  iban_number: string;
  org_number: string;
  vat_number: string;
  f_skatt: boolean;
  invoice_payment_terms: string;
  invoice_our_reference: string;
  invoice_late_interest: string;
};

const toDigits = (value: string) => value.replace(/\D/g, "");

const formatVatNumber = (value: string) => {
  const digits = toDigits(value || "");
  if (!digits) return "";
  let base = digits;
  if (digits.length >= 12 && digits.endsWith("01")) {
    base = digits.slice(0, -2);
  } else if (digits.length > 10) {
    base = digits.slice(0, 10);
  }
  return `SE${base}01`;
};

const AdminHub = () => {
  const { companyId } = useAuth();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<CompanyInvoiceForm>({
    billing_email: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    country: "",
    phone: "",
    bankgiro: "",
    bic_number: "",
    iban_number: "",
    org_number: "",
    vat_number: "",
    f_skatt: false,
    invoice_payment_terms: "",
    invoice_our_reference: "",
    invoice_late_interest: "",
  });

  useEffect(() => {
    fetchCompanyInfo();
  }, [companyId]);

  const fetchCompanyInfo = async (preserveInvoiceForm = false) => {
    setLoading(true);
    try {
      const companies = await apiFetch<any[]>("/companies");
      const selected = companyId
        ? (companies || []).find((c) => String(c.id) === String(companyId))
        : (companies || [])[0];

      if (!selected) {
        setCompanyInfo(null);
        return;
      }

      const users = await apiFetch<any[]>(`/admin/users?company_id=${selected.id}&include_inactive=1`);

      setCompanyInfo({
        id: String(selected.id),
        name: selected.name,
        code: selected.code || selected.company_code || null,
        created_at: selected.created_at || null,
        user_count: (users || []).length,
      });
      setCompanyName(selected.name || "");
      if (!preserveInvoiceForm) {
        setInvoiceForm({
          billing_email: selected.billing_email || "",
          address_line1: selected.address_line1 || "",
          address_line2: selected.address_line2 || "",
          postal_code: selected.postal_code || "",
          city: selected.city || "",
          country: selected.country || "",
        phone: selected.phone || "",
        bankgiro: selected.bankgiro || "",
        bic_number: selected.bic_number || "",
        iban_number: selected.iban_number || "",
        org_number: selected.org_number || "",
        vat_number: formatVatNumber(selected.vat_number || ""),
          f_skatt:
            selected.f_skatt === true ||
            selected.f_skatt === 1 ||
            selected.f_skatt === "1" ||
            selected.f_skatt === "true",
          invoice_payment_terms: selected.invoice_payment_terms || "",
          invoice_our_reference: selected.invoice_our_reference || "",
          invoice_late_interest: selected.invoice_late_interest || "",
        });
      }
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

  const saveInvoiceSettings = async () => {
    if (!companyInfo) return;
    try {
      await apiFetch(`/companies/${companyInfo.id}`, {
        method: "PUT",
        json: {
        billing_email: invoiceForm.billing_email || null,
        address_line1: invoiceForm.address_line1 || null,
        address_line2: invoiceForm.address_line2 || null,
        postal_code: invoiceForm.postal_code || null,
        city: invoiceForm.city || null,
        country: invoiceForm.country || null,
          phone: invoiceForm.phone || null,
          bankgiro: invoiceForm.bankgiro || null,
          bic_number: invoiceForm.bic_number || null,
          iban_number: invoiceForm.iban_number || null,
          org_number: invoiceForm.org_number || null,
        vat_number: formatVatNumber(invoiceForm.vat_number || "") || null,
        f_skatt: invoiceForm.f_skatt ? 1 : 0,
          invoice_payment_terms: invoiceForm.invoice_payment_terms || null,
          invoice_our_reference: invoiceForm.invoice_our_reference || null,
          invoice_late_interest: invoiceForm.invoice_late_interest || null,
        },
      });
      toast.success("Fakturauppgifter sparade.");
      setInvoiceForm((prev) => ({
        ...prev,
        vat_number: formatVatNumber(prev.vat_number || ""),
      }));
      fetchCompanyInfo(true);
    } catch (error: any) {
      console.error("Kunde inte spara fakturauppgifter:", error);
      toast.error("Kunde inte spara fakturauppgifter");
    }
  };

  const saveCompanyName = async () => {
    if (!companyInfo) return;
    const nextName = companyName.trim();
    if (!nextName) {
      toast.error("Företagsnamn krävs.");
      return;
    }
    setSavingName(true);
    try {
      await apiFetch(`/companies/${companyInfo.id}`, { method: "PUT", json: { name: nextName } });
      toast.success("Företagsnamn uppdaterat.");
      fetchCompanyInfo();
    } catch (error) {
      console.error("Kunde inte uppdatera företagsnamn:", error);
      toast.error("Kunde inte uppdatera företagsnamn");
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AdminHub</h1>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!companyInfo) {
    return (
      <div className="container mx-auto space-y-6 p-6">
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
    <div className="container mx-auto space-y-6 p-6">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Företagsnamn</p>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Företagsnamn"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Företagskod</p>
              <Badge variant="secondary">{companyInfo.code || "–"}</Badge>
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
                {companyInfo.created_at ? new Date(companyInfo.created_at).toLocaleDateString("sv-SE") : "–"}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveCompanyName} disabled={savingName}>
              Spara företagsnamn
            </Button>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-2">Företags-ID för inbjudningar</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Dela detta ID med anställda så de kan registrera sig och kopplas till ditt företag
            </p>
            <div className="flex items-center gap-3">
              <code className="bg-muted px-4 py-2 rounded text-lg font-mono">
                {companyInfo.code || "–"}
              </code>
              <Button
                variant="outline"
                onClick={() => companyInfo.code && copyToClipboard(companyInfo.code)}
                disabled={!companyInfo.code}
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
          <CardTitle>Fakturauppgifter</CardTitle>
          <CardDescription>Uppgifter som visas på fakturan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Adressrad 1</Label>
              <Input
                value={invoiceForm.address_line1}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, address_line1: e.target.value }))}
                placeholder="Gatuadress"
              />
            </div>
            <div className="space-y-2">
              <Label>Adressrad 2</Label>
              <Input
                value={invoiceForm.address_line2}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                placeholder="C/O, våning, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Postnummer</Label>
              <Input
                value={invoiceForm.postal_code}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                placeholder="123 45"
              />
            </div>
            <div className="space-y-2">
              <Label>Stad</Label>
              <Input
                value={invoiceForm.city}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Ort"
              />
            </div>
            <div className="space-y-2">
              <Label>Land</Label>
              <Input
                value={invoiceForm.country}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, country: e.target.value }))}
                placeholder="Sverige"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={invoiceForm.phone}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="07x..."
              />
            </div>
            <div className="space-y-2">
              <Label>E-post</Label>
              <Input
                value={invoiceForm.billing_email}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, billing_email: e.target.value }))}
                placeholder="faktura@foretag.se"
              />
            </div>
            <div className="space-y-2">
              <Label>Bankgiro</Label>
              <Input
                value={invoiceForm.bankgiro}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, bankgiro: e.target.value }))}
                placeholder="1234-5678"
              />
            </div>
            <div className="space-y-2">
              <Label>Kontonummer / IBAN</Label>
              <Input
                value={invoiceForm.iban_number}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, iban_number: e.target.value }))}
                placeholder="SE00 0000 0000 0000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label>BIC nummer</Label>
              <Input
                value={invoiceForm.bic_number}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, bic_number: e.target.value }))}
                placeholder="SWEDSESS"
              />
            </div>
            <div className="space-y-2">
              <Label>Organisationsnr</Label>
              <Input
                value={invoiceForm.org_number}
                onChange={(e) => {
                  const orgNumber = e.target.value;
                  const autoVat = formatVatNumber(orgNumber);
                  setInvoiceForm((prev) => ({
                    ...prev,
                    org_number: orgNumber,
                    vat_number: autoVat,
                  }));
                }}
                placeholder="559999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Momsreg. nr</Label>
              <Input
                value={invoiceForm.vat_number}
                onChange={(e) => {
                  const formatted = formatVatNumber(e.target.value);
                  setInvoiceForm((prev) => ({ ...prev, vat_number: formatted }));
                }}
                placeholder="SE559999999901"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                checked={invoiceForm.f_skatt}
                onCheckedChange={(checked) =>
                  setInvoiceForm((prev) => ({ ...prev, f_skatt: checked === true }))
                }
              />
              <Label>Godkänd för F-skatt</Label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Betalningsvillkor</Label>
              <Input
                value={invoiceForm.invoice_payment_terms}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_payment_terms: e.target.value }))}
                placeholder="30 dagar"
              />
            </div>
            <div className="space-y-2">
              <Label>Vår referens</Label>
              <Input
                value={invoiceForm.invoice_our_reference}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_our_reference: e.target.value }))}
                placeholder="Namn"
              />
            </div>
            <div className="space-y-2">
              <Label>Dröjsmålsränta</Label>
              <Input
                value={invoiceForm.invoice_late_interest}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_late_interest: e.target.value }))}
                placeholder="8%"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveInvoiceSettings}>Spara uppgifter</Button>
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
