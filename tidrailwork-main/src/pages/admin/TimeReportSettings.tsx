import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type TimeReportSettingsForm = {
  past_days: string;
  future_days: string;
  lock_days: string;
  extra_past_admin: string;
  extra_future_admin: string;
  extra_past_platschef: string;
  extra_future_platschef: string;
  extra_past_inhyrd: string;
  extra_future_inhyrd: string;
  extra_past_arbetsledare: string;
  extra_future_arbetsledare: string;
};

const TimeReportSettings = () => {
  const { companyId } = useAuth();
  const [timeReportSettings, setTimeReportSettings] = useState<TimeReportSettingsForm>({
    past_days: "60",
    future_days: "90",
    lock_days: "0",
    extra_past_admin: "0",
    extra_future_admin: "0",
    extra_past_platschef: "0",
    extra_future_platschef: "0",
    extra_past_inhyrd: "0",
    extra_future_inhyrd: "0",
    extra_past_arbetsledare: "0",
    extra_future_arbetsledare: "0",
  });
  const [timeReportLoading, setTimeReportLoading] = useState(false);
  const [savingTimeReportSettings, setSavingTimeReportSettings] = useState(false);

  const loadTimeReportSettings = async () => {
    setTimeReportLoading(true);
    try {
      const data = await apiFetch<{
        past_days?: number;
        future_days?: number;
        lock_days?: number;
        extra_past_admin?: number;
        extra_future_admin?: number;
        extra_past_platschef?: number;
        extra_future_platschef?: number;
        extra_past_inhyrd?: number;
        extra_future_inhyrd?: number;
        extra_past_arbetsledare?: number;
        extra_future_arbetsledare?: number;
      }>(
        "/admin/time-report-settings"
      );
      setTimeReportSettings({
        past_days: data?.past_days != null ? String(data.past_days) : "60",
        future_days: data?.future_days != null ? String(data.future_days) : "90",
        lock_days: data?.lock_days != null ? String(data.lock_days) : "0",
        extra_past_admin: data?.extra_past_admin != null ? String(data.extra_past_admin) : "0",
        extra_future_admin: data?.extra_future_admin != null ? String(data.extra_future_admin) : "0",
        extra_past_platschef: data?.extra_past_platschef != null ? String(data.extra_past_platschef) : "0",
        extra_future_platschef: data?.extra_future_platschef != null ? String(data.extra_future_platschef) : "0",
        extra_past_inhyrd: data?.extra_past_inhyrd != null ? String(data.extra_past_inhyrd) : "0",
        extra_future_inhyrd: data?.extra_future_inhyrd != null ? String(data.extra_future_inhyrd) : "0",
        extra_past_arbetsledare:
          data?.extra_past_arbetsledare != null ? String(data.extra_past_arbetsledare) : "0",
        extra_future_arbetsledare:
          data?.extra_future_arbetsledare != null ? String(data.extra_future_arbetsledare) : "0",
      });
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta tidrapporteringsinställningar");
    } finally {
      setTimeReportLoading(false);
    }
  };

  useEffect(() => {
    loadTimeReportSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const saveTimeReportSettings = async () => {
    setSavingTimeReportSettings(true);
    try {
      await apiFetch("/admin/time-report-settings", {
        method: "PATCH",
        json: {
          past_days: Number(timeReportSettings.past_days || 0),
          future_days: Number(timeReportSettings.future_days || 0),
          lock_days: Number(timeReportSettings.lock_days || 0),
          extra_past_admin: Number(timeReportSettings.extra_past_admin || 0),
          extra_future_admin: Number(timeReportSettings.extra_future_admin || 0),
          extra_past_platschef: Number(timeReportSettings.extra_past_platschef || 0),
          extra_future_platschef: Number(timeReportSettings.extra_future_platschef || 0),
          extra_past_inhyrd: Number(timeReportSettings.extra_past_inhyrd || 0),
          extra_future_inhyrd: Number(timeReportSettings.extra_future_inhyrd || 0),
          extra_past_arbetsledare: Number(timeReportSettings.extra_past_arbetsledare || 0),
          extra_future_arbetsledare: Number(timeReportSettings.extra_future_arbetsledare || 0),
        },
      });
      toast.success("Tidrapporteringsinställningar sparade.");
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara tidrapporteringsinställningar");
    } finally {
      setSavingTimeReportSettings(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Tidrapporteringsinställningar</h1>
        <p className="text-muted-foreground">
          Styr hur långt bakåt och framåt användare kan tidrapportera.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inställningar</CardTitle>
          <CardDescription>
            Låsning begränsar hur långt bakåt rapportering är tillåten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Dagar bakåt</Label>
              <Input
                type="number"
                min="0"
                value={timeReportSettings.past_days}
                onChange={(e) =>
                  setTimeReportSettings((prev) => ({ ...prev, past_days: e.target.value }))
                }
                placeholder="60"
                disabled={timeReportLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Dagar framåt</Label>
              <Input
                type="number"
                min="0"
                value={timeReportSettings.future_days}
                onChange={(e) =>
                  setTimeReportSettings((prev) => ({ ...prev, future_days: e.target.value }))
                }
                placeholder="90"
                disabled={timeReportLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extra dagar per roll</CardTitle>
          <CardDescription>
            Extra dagar läggs ovanpå standardinställningen. Om låsning är satt gäller den alltid
            och kan begränsa både standard och extra dagar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold">Admin</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Extra dagar bakåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_past_admin}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_past_admin: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra dagar framåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_future_admin}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_future_admin: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold">Platschef</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Extra dagar bakåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_past_platschef}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_past_platschef: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra dagar framåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_future_platschef}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_future_platschef: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold">Inhyrd</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Extra dagar bakåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_past_inhyrd}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_past_inhyrd: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra dagar framåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_future_inhyrd}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_future_inhyrd: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold">Arbetsledare</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Extra dagar bakåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_past_arbetsledare}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_past_arbetsledare: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra dagar framåt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={timeReportSettings.extra_future_arbetsledare}
                    onChange={(e) =>
                      setTimeReportSettings((prev) => ({ ...prev, extra_future_arbetsledare: e.target.value }))
                    }
                    placeholder="0"
                    disabled={timeReportLoading}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveTimeReportSettings} disabled={savingTimeReportSettings || timeReportLoading}>
              {savingTimeReportSettings ? "Sparar..." : "Spara inställningar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeReportSettings;
