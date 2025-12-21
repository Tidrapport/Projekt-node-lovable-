import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";

export const ImpersonationBanner = () => {
  const { impersonatedUser, setImpersonatedUser, isImpersonating } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Visar som: <strong>{impersonatedUser?.full_name}</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 hover:bg-amber-600 text-amber-950"
        onClick={() => setImpersonatedUser(null)}
      >
        <X className="h-4 w-4 mr-1" />
        Avsluta
      </Button>
    </div>
  );
};
