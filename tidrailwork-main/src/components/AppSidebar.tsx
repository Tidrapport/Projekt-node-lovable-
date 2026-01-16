import { LogOut, Building2, Crown, ChevronRight } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserImpersonationSelector } from "./UserImpersonationSelector";
import { SuperAdminCompanySwitcher } from "./SuperAdminCompanySwitcher";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ADMIN_HUB_ITEMS, ADMIN_MAIN_ITEMS, applyMenuOrder, USER_MENU_ITEMS } from "@/lib/menuConfig";
import { PlanUpgradeDialog } from "@/components/PlanUpgradeDialog";

const superAdminItems = [
  { title: "Super Admin", url: "/superadmin", icon: Crown },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isAdmin, isSuperAdmin, isImpersonated, hasFeature, signOut, menuSettings, companyPlan } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";
  const shouldFilter = !isSuperAdmin || isImpersonated;
  const allowItem = (item: { feature?: string }) => !shouldFilter || !item.feature || hasFeature(item.feature);
  const filteredUserItems = applyMenuOrder(USER_MENU_ITEMS.filter(allowItem), menuSettings?.user);
  const filteredAdminMainItems = applyMenuOrder(ADMIN_MAIN_ITEMS.filter(allowItem), menuSettings?.admin_main);
  const filteredAdminHubItems = applyMenuOrder(ADMIN_HUB_ITEMS.filter(allowItem), menuSettings?.admin_hub);
  const showAdminHub = filteredAdminHubItems.length > 0;
  const showUpgrade = isAdmin && !isSuperAdmin && (companyPlan === "Bas" || companyPlan === "Pro");

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Användare</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredUserItems.map((item) => (
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
                {filteredAdminMainItems.map((item) => (
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
                {showAdminHub && (
                  <Collapsible
                    defaultOpen={filteredAdminHubItems.some((item) => isActive(item.url))}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={filteredAdminHubItems.some((item) => isActive(item.url))}>
                          <Building2 />
                          <span>AdminHub</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {filteredAdminHubItems.map((item) => (
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
                )}
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

        {!isCollapsed && isSuperAdmin && (
          <SuperAdminCompanySwitcher />
        )}

        {!isCollapsed && isAdmin && (
          <UserImpersonationSelector />
        )}

        {!isCollapsed && (
          <div className="mt-auto p-4 space-y-2">
            {showUpgrade && <PlanUpgradeDialog currentPlan={companyPlan} />}
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logga ut
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
