import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle } from "lucide-react";

type FortnoxStatus = {
  connected: boolean;
  expires_at?: string | null;
  scope?: string | null;
  updated_at?: string | null;
};

const InvoiceSettings = () => {
  const { companyId, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<FortnoxStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConnectedBanner, setShowConnectedBanner] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("fortnox");
    if (result === "connected") {
      toast.success("Fortnox-koppling klar.");
      setShowConnectedBanner(true);
    }
    if (result === "error") toast.error("Fortnox-koppling misslyckades.");
  }, [location.search]);

  const scopeLabels: Record<string, string> = {
    customer: "Kund",
    invoice: "Faktura",
    article: "Artikel",
    salary: "Lön",
    archive: "Arkivplats",
  };
  const connectedScopes = (status?.scope || "")
    .split(/\s+/)
    .map((scope) => scopeLabels[scope])
    .filter(Boolean);
  const connectedScopeText = connectedScopes.length
    ? connectedScopes.join(", ")
    : "Kund, Faktura, Lön";

  const loadStatus = async () => {
    if (isSuperAdmin && !companyId) return;
    setLoading(true);
    try {
      const query = isSuperAdmin && companyId ? `?company_id=${companyId}` : "";
      const data = await apiFetch<FortnoxStatus>(`/admin/fortnox/status${query}`);
      setStatus(data || { connected: false });
    } catch (err: any) {
      console.error("Kunde inte läsa Fortnox-status:", err);
      toast.error(err.message || "Kunde inte läsa Fortnox-status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isSuperAdmin]);

  const handleConnect = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (isSuperAdmin && !companyId) {
      toast.error("Välj företag först.");
      return;
    }
    const query = isSuperAdmin && companyId ? `?company_id=${companyId}` : "";
    try {
      const res = await apiFetch<any>(`/admin/fortnox/connect${query}`, { method: "POST" });
      // Log response for debugging redirect payloads
      console.log("Redirect payload from backend (fortnox connect):", res);

      // Normalize different possible keys from backend
      const redirectUrl = res?.auth_url || res?.authUrl || res?.url;

      // Validate before redirecting to avoid runtime errors like new URL(undefined)
      if (!redirectUrl || typeof redirectUrl !== "string") {
        console.error("Invalid redirect URL from backend:", res);
        toast.error("Ogiltigt svar från servern (saknas URL)");
        return;
      }

      // Safe redirect
      window.location.href = redirectUrl;
    } catch (err: any) {
      toast.error(err.message || "Kunde inte starta Fortnox-koppling");
    }
  };

  const handleDisconnect = async () => {
    if (isSuperAdmin && !companyId) return;
    setDisconnecting(true);
    try {
      const query = isSuperAdmin && companyId ? `?company_id=${companyId}` : "";
      await apiFetch(`/admin/fortnox/disconnect${query}`, { method: "POST" });
      toast.success("Fortnox-koppling borttagen.");
      await loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte koppla bort");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Faktura-inställningar</h1>
        <p className="text-muted-foreground">Hantera standarder för fakturaunderlag och export.</p>
      </div>

      {showConnectedBanner && status?.connected && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/opero-systems-logo.png"
                alt="Opero Systems AB"
                className="h-12 w-auto"
              />
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <p className="text-lg font-semibold">Yes! Integrationen är kopplad.</p>
                </div>
                <p className="text-sm text-emerald-800">
                  Du har kopplat: {connectedScopeText}.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowConnectedBanner(false)}>
              Stäng
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fortnox API-koppling</CardTitle>
          <CardDescription>Autentisera mot Fortnox via OAuth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuperAdmin && !companyId ? (
            <div className="text-sm text-muted-foreground">Välj företag i AdminHub för att koppla Fortnox.</div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Status:{" "}
                {loading
                  ? "Laddar..."
                  : status?.connected
                    ? `Ansluten${status.expires_at ? ` (giltig till ${status.expires_at?.slice(0, 19).replace("T", " ")})` : ""}`
                    : "Inte ansluten"}
              </div>
              {status?.scope && (
                <div className="text-xs text-muted-foreground">Scope: {status.scope}</div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={loadStatus} disabled={loading}>
                  Uppdatera
                </Button>
                {status?.connected ? (
                  <Button type="button" variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                    Koppla bort
                  </Button>
                ) : (
                  <Button type="button" onClick={handleConnect}>
                    Anslut Fortnox
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prislista</CardTitle>
          <CardDescription>Skapa och hantera prislistor för fakturering.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button asChild variant="outline">
            <Link to="/admin/price-list">Gå till prislista</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceSettings;
