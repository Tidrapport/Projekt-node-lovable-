import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/api/client";
import { toast } from "sonner";
import { Loader2, Percent, Clock } from "lucide-react";

interface OBConfig {
  id: string;
  shift_type: "day" | "evening" | "night" | "weekend" | "overtime_day" | "overtime_weekend";
  multiplier: number;
  description: string;
  start_hour: number;
  end_hour: number;
}

interface CompensationSettings {
  travel_rate: number;
}

const OBSettings = () => {
  const [configs, setConfigs] = useState<OBConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [travelRate, setTravelRate] = useState(170);
  const [savingTravelRate, setSavingTravelRate] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const [shiftData, travelData] = await Promise.all([
        apiFetch<OBConfig[]>("/admin/ob-settings"),
        apiFetch<CompensationSettings>("/admin/compensation-settings"),
      ]);
      setConfigs(shiftData || []);
      if (travelData?.travel_rate != null) {
        setTravelRate(Number(travelData.travel_rate) || 170);
      }
    } catch (error) {
      toast.error("Kunde inte hämta OB-inställningar");
      console.error(error);
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, config: OBConfig) => {
    setSaving(true);
    try {
      const updated = await apiFetch<OBConfig>(`/admin/ob-settings/${id}`, {
        method: "PATCH",
        json: {
          multiplier: config.multiplier,
          start_hour: config.start_hour,
          end_hour: config.end_hour,
        },
      });
      setConfigs((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success("OB-inställningar uppdaterade");
    } catch (error) {
      toast.error("Kunde inte uppdatera OB-inställningar");
      console.error(error);
    }
    setSaving(false);
  };

  const handleTravelRateSave = async () => {
    setSavingTravelRate(true);
    try {
      const updated = await apiFetch<CompensationSettings>("/admin/compensation-settings", {
        method: "PATCH",
        json: { travel_rate: travelRate },
      });
      setTravelRate(Number(updated.travel_rate) || travelRate);
      toast.success("Restidsersättning uppdaterad");
    } catch (error) {
      toast.error("Kunde inte uppdatera restidsersättning");
      console.error(error);
    } finally {
      setSavingTravelRate(false);
    }
  };

  const getShiftTypeName = (type: string) => {
    const names: Record<string, string> = {
      day: "Dag",
      evening: "Kväll",
      night: "Natt",
      weekend: "Helg",
      overtime_day: "Övertid vardag",
      overtime_weekend: "Övertid helg",
    };
    return names[type] || type;
  };

  const getPercentage = (multiplier: number) => {
    return ((multiplier - 1) * 100).toFixed(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">OB-inställningar</h2>
        <p className="text-muted-foreground">
          Hantera OB-tillägg för olika tidsperioder
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {configs.map((config) => (
          <Card key={config.id} className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                {getShiftTypeName(config.shift_type)}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`start-${config.id}`} className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Starttid
                  </Label>
                  <Input
                    id={`start-${config.id}`}
                    type="number"
                    min="0"
                    max="23"
                    value={config.start_hour}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      setConfigs(
                        configs.map((c) =>
                          c.id === config.id ? { ...c, start_hour: newValue } : c
                        )
                      );
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`end-${config.id}`} className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Sluttid
                  </Label>
                  <Input
                    id={`end-${config.id}`}
                    type="number"
                    min="0"
                    max="23"
                    value={config.end_hour}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      setConfigs(
                        configs.map((c) =>
                          c.id === config.id ? { ...c, end_hour: newValue } : c
                        )
                      );
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`multiplier-${config.id}`}>
                  Multiplikator ({getPercentage(config.multiplier)}% tillägg)
                </Label>
                <Input
                  id={`multiplier-${config.id}`}
                  type="number"
                  step="0.01"
                  min="1"
                  max="5"
                  value={config.multiplier}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value);
                    setConfigs(
                      configs.map((c) =>
                        c.id === config.id ? { ...c, multiplier: newValue } : c
                      )
                    );
                  }}
                />
              </div>

              <Button
                onClick={() => handleUpdate(config.id, config)}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Spara ändringar"
                )}
              </Button>

              <div className="bg-muted p-3 rounded-md space-y-1">
                <p className="text-sm font-medium">Tider: {config.start_hour}:00 - {config.end_hour}:00</p>
                <p className="text-sm text-muted-foreground">
                  Timlön: 200 kr/h → OB-lön: {(200 * config.multiplier).toFixed(0)} kr/h
                </p>
                <p className="text-sm font-medium text-primary">
                  Tillägg: +{(200 * (config.multiplier - 1)).toFixed(0)} kr/h ({getPercentage(config.multiplier)}%)
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Restidsersättning
            </CardTitle>
            <CardDescription>Timersättning för restid</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="travelRate">Belopp (kr per timme)</Label>
              <Input
                id="travelRate"
                type="number"
                step="1"
                min="0"
                value={travelRate}
                onChange={(e) => setTravelRate(parseFloat(e.target.value))}
              />
            </div>

            <Button
              onClick={handleTravelRateSave}
              disabled={savingTravelRate}
              className="w-full"
            >
              {savingTravelRate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Spara ändringar"
              )}
            </Button>

            <div className="bg-muted p-3 rounded-md space-y-1">
              <p className="text-sm font-medium">Ersättning: {travelRate} kr/h</p>
              <p className="text-sm text-muted-foreground">Gäller all restid som registreras</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader>
          <CardTitle>Information om OB-beräkning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            OB-tillägg beräknas automatiskt baserat på arbetade timmar inom respektive tidsperiod. 
            Helg-OB gäller från fredag kväll till måndag morgon och har högst prioritet.
          </p>
          <p className="text-sm text-muted-foreground">
            Tiderna och multiplikatorerna ovan kan justeras för att matcha ert kollektivavtal eller företagspolicy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OBSettings;
