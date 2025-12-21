import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export const useEffectiveUser = () => {
  const { user, isAdmin, companyId } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();

  // If admin is impersonating, use the impersonated user's ID
  const effectiveUserId = isAdmin && isImpersonating && impersonatedUser 
    ? impersonatedUser.id 
    : user?.id;

  return {
    effectiveUserId,
    isImpersonating: isAdmin && isImpersonating,
    impersonatedUserName: impersonatedUser?.full_name,
    realUser: user,
    companyId,
  };
};
