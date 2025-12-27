import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const FORTNOX_STORAGE_KEY = "fortnox_api_settings";

const InvoiceSettings = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(FORTNOX_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setClientId(parsed.clientId || "");
      setClientSecret(parsed.clientSecret || "");
      setAccessToken(parsed.accessToken || "");
    } catch (err) {
      console.error("Kunde inte läsa Fortnox-inställningar:", err);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(
      FORTNOX_STORAGE_KEY,
      JSON.stringify({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        accessToken: accessToken.trim(),
      })
    );
    toast.success("Fortnox-uppgifter sparade.");
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Faktura-inställningar</h1>
        <p className="text-muted-foreground">Hantera standarder för fakturaunderlag och export.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fortnox API-koppling</CardTitle>
          <CardDescription>Ange era nycklar för koppling till Fortnox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fortnox-client-id">Client-ID</Label>
            <Input
              id="fortnox-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Ange Client-ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fortnox-client-secret">Client Secret</Label>
            <Input
              id="fortnox-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Ange Client Secret"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fortnox-access-token">Access Token</Label>
            <Input
              id="fortnox-access-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Ange Access Token"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave}>Spara</Button>
          </div>
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
