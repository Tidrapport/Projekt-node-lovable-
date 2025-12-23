import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { apiFetch } from "@/api/client";

export const UserImpersonationSelector = () => {
  const { companyId, isAdmin } = useAuth();
  const { impersonatedUser, setImpersonatedUser } = useImpersonation();

  const { data: users = [] } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: async () => {
      const data = await apiFetch(`/admin/users?company_id=${companyId}`);
      return data || [];
    },
    enabled: !!companyId && isAdmin,
  });

  if (!isAdmin || users.length === 0) return null;

  const handleChange = (value: string) => {
    if (value === "none") {
      setImpersonatedUser(null);
    } else {
      const user = users.find((u) => u.id === value);
      if (user) {
        setImpersonatedUser({ id: user.id, full_name: user.full_name });
      }
    }
  };

  return (
    <div className="px-4 py-2 border-t border-sidebar-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Eye className="h-3 w-3" />
        <span>Visa som användare</span>
      </div>
      <Select value={impersonatedUser?.id || "none"} onValueChange={handleChange}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue placeholder="Välj användare..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-- Ingen (visa egen vy) --</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
