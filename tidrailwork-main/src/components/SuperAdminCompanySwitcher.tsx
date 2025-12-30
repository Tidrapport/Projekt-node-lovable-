import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, setToken } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type CompanyOption = {
  id: string;
  name: string;
};

export const SuperAdminCompanySwitcher = () => {
  const { isSuperAdmin, companyId, homeCompanyId, isImpersonated, refresh } = useAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    apiFetch<CompanyOption[]>("/companies")
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : data && Array.isArray((data as any).companies)
          ? (data as any).companies
          : [];
        setCompanies(list);
      })
      .catch((err: any) => {
        toast.error(err.message || "Kunde inte hämta företag");
      })
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const homeCompanyName = useMemo(() => {
    if (!homeCompanyId) return "Opero Systems AB";
    const match = companies.find((c) => String(c.id) === String(homeCompanyId));
    return match?.name || "Opero Systems AB";
  }, [companies, homeCompanyId]);

  const handleChange = async (value: string) => {
    if (!value || switching) return;
    const targetId = Number(value);
    const isHomeTarget = homeCompanyId && String(targetId) === String(homeCompanyId);
    const isSameCompany = companyId && String(targetId) === String(companyId);

    if (isSameCompany && (!isImpersonated || !isHomeTarget)) return;
    if (isHomeTarget && !isImpersonated) return;

    setSwitching(true);
    try {
      const res = await apiFetch<{ access_token?: string }>(
        isHomeTarget ? "/superadmin/stop-impersonate" : "/superadmin/impersonate",
        {
          method: "POST",
          json: isHomeTarget ? {} : { company_id: targetId },
        }
      );
      if (res?.access_token) {
        setToken(res.access_token);
        await refresh();
        toast.success(isHomeTarget ? `Återgick till ${homeCompanyName}` : "Bytte företag");
      }
    } catch (err: any) {
      toast.error(err.message || "Kunde inte byta företag");
    } finally {
      setSwitching(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="px-4 py-2 border-t border-sidebar-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Building2 className="h-3 w-3" />
        <span>Företag (super admin)</span>
      </div>
      <Select
        value={companyId ? String(companyId) : ""}
        onValueChange={handleChange}
      >
        <SelectTrigger className="w-full h-8 text-xs" disabled={loading || switching}>
          <SelectValue placeholder={loading ? "Laddar företag..." : "Välj företag..."} />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => {
            const isHome = homeCompanyId && String(company.id) === String(homeCompanyId);
            return (
              <SelectItem key={company.id} value={String(company.id)}>
                {company.name}
                {isHome ? " (Bas)" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {isImpersonated && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Visar företag: {companies.find((c) => String(c.id) === String(companyId))?.name || companyId}
        </p>
      )}
    </div>
  );
};
