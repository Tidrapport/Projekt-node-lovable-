import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserPlanningGantt } from "@/components/UserPlanningGantt";
import { CalendarDays } from "lucide-react";

interface ScheduledAssignment {
  id: string;
  project_id: string;
  subproject_id: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  first_shift_start_time: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  vehicle: string | null;
  work_address: string | null;
  is_tentative?: boolean;
  projects: {
    name: string;
    location?: string | null;
    customer_name?: string | null;
    work_task?: string | null;
    description?: string | null;
  };
  subprojects: {
    name: string;
    description?: string | null;
  } | null;
}

export default function Planning() {
  const { effectiveUserId, isImpersonating, impersonatedUserName } = useEffectiveUser();
  const { companyId } = useAuth();
  const [assignments, setAssignments] = useState<ScheduledAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (effectiveUserId) {
      fetchAssignments();
    }
  }, [effectiveUserId]);

  const fetchAssignments = async () => {
    try {
      // Hämta endast aktuell användares planering
      const companyParam = companyId ? `&company_id=${companyId}` : "";
      const data = await apiFetch(`/plans?user_id=${effectiveUserId}${companyParam}`);
      const filtered = (data || []).filter((p: any) => String(p.user_id) === String(effectiveUserId));
      const mapped = filtered.map((p: any) => ({
        id: String(p.id),
        project_id: p.project || "",
        subproject_id: p.subproject || null,
        start_date: p.start_date,
        end_date: p.end_date,
        notes: p.notes || null,
        first_shift_start_time: p.first_shift_start_time || null,
        contact_person: p.contact_person || null,
        contact_phone: p.contact_phone || null,
        vehicle: p.vehicle || null,
        work_address: p.work_address || null,
        is_tentative: p.tentative === 1 || p.tentative === true,
        projects: { name: p.project || "" },
        subprojects: p.subproject ? { name: p.subproject } : null,
      }));
      setAssignments(mapped);
    } catch (error: any) {
      console.error("Error fetching assignments:", error);
      toast.error("Kunde inte hämta planeringar");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-5 w-5 animate-pulse" />
          <span>Laddar planering...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <CalendarDays className="h-8 w-8" />
          Planering
          {isImpersonating && (
            <span className="text-lg font-normal text-muted-foreground">
              - {impersonatedUserName}
            </span>
          )}
        </h1>
        <p className="text-muted-foreground">
          {isImpersonating
            ? `Visar ${impersonatedUserName}s arbetsplanering`
            : "Se din arbetsplanering i tidslinjen nedan"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Min planering</CardTitle>
          <CardDescription>
            Klicka på ett projekt för att se mer information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserPlanningGantt assignments={assignments} />
        </CardContent>
      </Card>
    </div>
  );
}
