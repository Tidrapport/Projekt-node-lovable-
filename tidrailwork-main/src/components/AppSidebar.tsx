import { 
  Home, 
  Clock, 
  AlertTriangle, 
  FolderKanban, 
  Users, 
  Briefcase,
  Package,
  LogOut,
  Shield,
  CheckSquare,
  AlertCircle,
  Percent,
  DollarSign,
  BarChart3,
  Calendar,
  Building2,
  Crown,
  Key,
  Contact,
  ChevronRight,
  FileText,
  Wallet
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserImpersonationSelector } from "./UserImpersonationSelector";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const userItems = [
  { title: "Översikt", url: "/", icon: Home },
  { title: "Tidrapporter", url: "/time-reports", icon: Clock },
  { title: "Svetsrapport", url: "/welding-report", icon: Briefcase },
  { title: "Planering", url: "/planning", icon: Calendar },
  { title: "Avvikelser", url: "/deviations", icon: AlertTriangle },
  { title: "Lönöversikt", url: "/salary-overview", icon: DollarSign },
  { title: "Kontakter", url: "/contacts", icon: Contact },
  { title: "Byt lösenord", url: "/change-password", icon: Key },
];

// Main admin items (not under AdminHub)
const adminMainItems = [
  { title: "Admin Panel", url: "/admin/dashboard", icon: Shield },
  { title: "Statistik", url: "/admin/statistics", icon: BarChart3 },
  { title: "Attestering", url: "/admin/attestations", icon: CheckSquare },
  { title: "Fakturering", url: "/admin/billing", icon: FileText },
  { title: "Löner", url: "/admin/salaries", icon: Wallet },
  { title: "Svetsrapporter", url: "/admin/welding-reports", icon: Briefcase },
  { title: "Planering", url: "/admin/planning", icon: Calendar },
  { title: "Avvikelser", url: "/admin/deviations", icon: AlertCircle },
  { title: "Kunder", url: "/admin/customers", icon: Users },
  { title: "Offerter", url: "/admin/offers", icon: FileText },
  { title: "Projekt", url: "/admin/projects", icon: FolderKanban },
];

// Sub-items under AdminHub
const adminHubSubItems = [
  { title: "Användare", url: "/admin/users", icon: Users },
  { title: "Yrkesroller", url: "/admin/job-roles", icon: Briefcase },
  { title: "Tillägg", url: "/admin/material-types", icon: Package },
  { title: "OB-inställningar", url: "/admin/ob-settings", icon: Percent },
];

const superAdminItems = [
  { title: "Super Admin", url: "/superadmin", icon: Crown },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isAdmin, isSuperAdmin, signOut } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Användare</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {/* AdminHub with sub-items */}
                <Collapsible
                  defaultOpen={adminHubSubItems.some(item => isActive(item.url))}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isActive("/admin/hub") || adminHubSubItems.some(item => isActive(item.url))}>
                        <Building2 />
                        <span>AdminHub</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/admin/hub")}>
                            <NavLink to="/admin/hub">
                              <span>Översikt</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {adminHubSubItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                              <NavLink to={item.url}>
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Super Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isCollapsed && isAdmin && (
          <UserImpersonationSelector />
        )}

        {!isCollapsed && (
          <div className="mt-auto p-4">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logga ut
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
