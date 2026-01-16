import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { FEATURE_LABELS } from "@/lib/featureLabels";
import { toast } from "sonner";

type PlanSetting = {
  plan: string;
  features: string[];
};

type PlanChangeRequest = {
  id: string | number;
  requested_plan?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const PLAN_ORDER = ["Bas", "Pro", "Entreprise"];

const parseSqlDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
};

const buildDeadline = (value?: string | null) => {
  const created = parseSqlDate(value);
  if (!created) return null;
  return new Date(created.getTime() + 24 * 60 * 60 * 1000);
};

const formatDateTime = (value?: Date | null) => {
  if (!value) return "–";
  return value.toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const PlanUpgradeDialog = ({ currentPlan }: { currentPlan: string | null }) => {
  const [open, setOpen] = useState(false);
  const [planSettings, setPlanSettings] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PlanChangeRequest | null>(null);
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null);

  const sortedPlans = useMemo(
    () =>
      PLAN_ORDER.filter((plan) => planSettings[plan] !== undefined).map((plan) => ({
        plan,
        features: planSettings[plan] || [],
      })),
    [planSettings]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [planData, requestData] = await Promise.all([
        apiFetch<PlanSetting[]>(`/plan-settings/public`),
        apiFetch<PlanChangeRequest[]>(`/plan-change-requests?status=pending`),
      ]);
      const planMap: Record<string, string[]> = {};
      ensureArray(planData).forEach((item) => {
        planMap[item.plan] = Array.isArray(item.features) ? item.features : [];
      });
      PLAN_ORDER.forEach((plan) => {
        if (!planMap[plan]) planMap[plan] = [];
      });
      const requests = ensureArray(requestData);
      setPendingRequest(requests.length ? requests[0] : null);
      setPlanSettings(planMap);
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta plan");
      setPlanSettings({});
      setPendingRequest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const handleRequest = async (plan: string) => {
    setRequestingPlan(plan);
    try {
      await apiFetch(`/plan-change-requests`, {
        method: "POST",
        json: { requested_plan: plan },
      });
      toast.success("Begäran skickad");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte skicka begäran");
    } finally {
      setRequestingPlan(null);
    }
  };

  const normalizedCurrentPlan = currentPlan || "Bas";
  const currentIndex = PLAN_ORDER.indexOf(normalizedCurrentPlan);
  const pendingDeadline = buildDeadline(pendingRequest?.created_at || null);
  const hasPending = pendingRequest?.status === "pending";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full justify-between">
          <span>Uppgradera</span>
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Uppgradera eller nedgradera plan</DialogTitle>
          <DialogDescription>
            Super admin godkänner inom 24 timmar efter att du skickat en begäran.
          </DialogDescription>
        </DialogHeader>

        {hasPending && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
            <div>
              <p className="font-medium">Begäran skickad</p>
              <p className="text-muted-foreground">
                Väntar på godkännande. Deadline: {formatDateTime(pendingDeadline)}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {(sortedPlans.length ? sortedPlans : PLAN_ORDER.map((plan) => ({ plan, features: [] }))).map(
            ({ plan, features }) => {
              const isCurrent = normalizedCurrentPlan === plan;
              const planIndex = PLAN_ORDER.indexOf(plan);
              const isUpgrade = currentIndex !== -1 && planIndex !== -1 ? planIndex > currentIndex : false;
              const actionLabel =
                currentIndex === -1 || planIndex === -1
                  ? "Begär plan"
                  : isUpgrade
                  ? "Begär uppgradering"
                  : "Begär nedgradering";
              const isDisabled = isCurrent || hasPending || loading;
              return (
                <div key={plan} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{plan}</h3>
                    {isCurrent && <Badge variant="secondary">Aktuell</Badge>}
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground max-h-40 overflow-auto">
                    {features.length ? (
                      features.map((feature) => (
                        <li key={feature}>• {FEATURE_LABELS[feature] || feature}</li>
                      ))
                    ) : (
                      <li>Inga funktioner valda.</li>
                    )}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isDisabled || requestingPlan === plan}
                    onClick={() => handleRequest(plan)}
                  >
                    {isCurrent ? "Aktuell plan" : actionLabel}
                  </Button>
                </div>
              );
            }
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Du kan bara ha en väntande planändring åt gången.
        </p>
      </DialogContent>
    </Dialog>
  );
};
