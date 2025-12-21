import { createContext, useContext, useState, ReactNode } from "react";

interface ImpersonatedUser {
  id: string;
  full_name: string;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  setImpersonatedUser: (user: ImpersonatedUser | null) => void;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        setImpersonatedUser,
        isImpersonating: !!impersonatedUser,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
};
