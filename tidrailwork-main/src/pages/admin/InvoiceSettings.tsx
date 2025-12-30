import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type FortnoxStatus = {
  connected: boolean;
  expires_at?: string | null;
  scope?: string | null;
  updated_at?: string | null;
};

const InvoiceSettings = () => {
  const { companyId, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<FortnoxStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConnectedBanner, setShowConnectedBanner] = useState(false);
  const [allowedScopes, setAllowedScopes] = useState<string[]>([]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [showScopePicker, setShowScopePicker] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("fortnox");
    if (result === "connected") {
      toast.success("Fortnox-koppling klar.");
      setShowConnectedBanner(true);
    }
    if (result === "error") toast.error("Fortnox-koppling misslyckades.");
  }, [location.search]);

  useEffect(() => {
    if (!showConnectedBanner) {
      setRedirectCountdown(null);
      return;
    }
    setRedirectCountdown(5);
    const interval = window.setInterval(() => {
      setRedirectCountdown((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
    }, 1000);
    const timeout = window.setTimeout(() => {
      navigate("/admin/billing");
    }, 5000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [showConnectedBanner, navigate]);

  const scopeLabels: Record<string, string> = {
    customer: "Kund",
    invoice: "Faktura",
    article: "Artikel",
    salary: "Lön",
    archive: "Arkivplats",
    time: "Tid",
  };
  const scopeSource = status?.scope
    ? status.scope.split(" ")
    : allowedScopes.length
      ? allowedScopes
      : ["customer", "invoice", "article", "salary", "archive"];
  const connectedScopes = scopeSource
    .map((scope) => scopeLabels[scope])
    .filter(Boolean);
  const connectedScopeText = connectedScopes.length
    ? connectedScopes.join(", ")
    : "Kund, Faktura, Lön";

  const successView = (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-600/10 p-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Integrationen är klar
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-emerald-950">
                Yes! Fortnox är kopplat.
              </h1>
              <p className="text-sm text-emerald-800">
                Du kan nu använda integrationen direkt i Opero.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {connectedScopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900"
                  >
                    {scope}
                  </span>
                ))}
              </div>
              {typeof redirectCountdown === "number" && (
                <p className="mt-4 text-xs text-emerald-800">
                  Du skickas automatiskt till Fakturering om {redirectCountdown} sekunder.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/billing">Gå till fakturering</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/salaries">Gå till löner</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/price-list">Gå till prislista</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Fakturering</CardTitle>
            <CardDescription>Skicka fakturaunderlag direkt till Fortnox.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button asChild>
              <Link to="/admin/billing">Öppna fakturering</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Löner</CardTitle>
            <CardDescription>Skapa löneunderlag och skicka till Fortnox.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button asChild>
              <Link to="/admin/salaries">Öppna löner</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prislista</CardTitle>
            <CardDescription>Synka artiklar och uppdatera era prislistor.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button asChild variant="outline">
              <Link to="/admin/price-list">Öppna prislista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setShowConnectedBanner(false);
            setRedirectCountdown(null);
          }}
        >
          Visa integrationsinställningar
        </Button>
      </div>
    </div>
  );

  const loadStatus = async () => {
    if (isSuperAdmin && !companyId) return;
    setLoading(true);
    try {
      const query = isSuperAdmin && companyId ? `?company_id=${companyId}` : "";
      const [data, scopesData] = await Promise.all([
        apiFetch<FortnoxStatus>(`/admin/fortnox/status${query}`),
        apiFetch<{ allowed: string[] }>("/admin/fortnox/scopes"),
      ]);
      setStatus(data || { connected: false });
      const nextAllowed = scopesData?.allowed || [];
      setAllowedScopes(nextAllowed);
      setSelectedScopes((prev) => (prev.length ? prev : nextAllowed));
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
      const res = await apiFetch<any>(`/admin/fortnox/connect${query}`, {
        method: "POST",
        json: { scopes: selectedScopes },
      });
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

  const settingsView = (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrationer</h1>
        <p className="text-muted-foreground">Hantera kopplingar och behörigheter för externa system.</p>
      </div>

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
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Behörigheter</p>
                    <p className="text-xs text-muted-foreground">
                      Vi använder automatiskt alla behörigheter som är aktiva i integrationen.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowScopePicker((prev) => !prev)}
                    className="text-xs"
                  >
                    Avancerat
                    <ChevronDown className={`ml-1 h-4 w-4 transition ${showScopePicker ? "rotate-180" : ""}`} />
                  </Button>
                </div>
                {showScopePicker && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {allowedScopes.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedScopes.includes(scope)}
                          onCheckedChange={(checked) => {
                            setSelectedScopes((prev) => {
                              if (checked) return Array.from(new Set([...prev, scope]));
                              return prev.filter((value) => value !== scope);
                            });
                          }}
                        />
                        <span>{scopeLabels[scope] || scope}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
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

  return showConnectedBanner ? successView : settingsView;
};

export default InvoiceSettings;
