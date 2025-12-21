import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { Train } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, company } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (data) {
          setFullName(data.full_name);
        }
      }
    };
    fetchUserName();
  }, [user?.id]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {user && <AppSidebar />}
        
        <div className="flex-1 flex flex-col">
          <ImpersonationBanner />
          <header className="h-16 border-b bg-gradient-primary flex items-center px-4 shadow-elevated justify-between">
            <div className="flex items-center">
              {user && <SidebarTrigger className="text-primary-foreground mr-4" />}
              <div className="flex items-center gap-3">
                <Train className="h-6 w-6 text-primary-foreground" />
                <h1 className="text-xl font-bold font-heading text-primary-foreground">
                  {company?.name || "Tidrapportering"}
                </h1>
              </div>
            </div>
            {user && (
              <span className="text-sm text-primary-foreground/80 hidden md:block">
                Välkommen, {fullName || 'Användare'}
              </span>
            )}
          </header>
          
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
