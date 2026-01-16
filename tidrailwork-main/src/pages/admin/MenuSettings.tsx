import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { MENU_SECTIONS, applyMenuOrder, buildMenuOrderIds, MenuSectionKey, MenuSettings } from "@/lib/menuConfig";
import { toast } from "sonner";

const MenuSettingsPage = () => {
  const { menuSettings, updateMenuSettings, hasFeature, isSuperAdmin, isImpersonated } = useAuth();
  const [localSettings, setLocalSettings] = useState<MenuSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const shouldFilter = !isSuperAdmin || isImpersonated;
  const allowItem = useCallback(
    (item: { feature?: string }) => !shouldFilter || !item.feature || hasFeature(item.feature),
    [hasFeature, shouldFilter]
  );

  const sections = useMemo(
    () =>
      MENU_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(allowItem),
      })).filter((section) => section.items.length > 0),
    [allowItem]
  );

  useEffect(() => {
    const nextSettings: MenuSettings = {};
    sections.forEach((section) => {
      nextSettings[section.key] = buildMenuOrderIds(section.items, menuSettings?.[section.key]);
    });
    setLocalSettings(nextSettings);
    setLoading(false);
  }, [menuSettings, sections]);

  const moveItem = (sectionKey: MenuSectionKey, fromIndex: number, direction: number) => {
    setLocalSettings((prev) => {
      const order = [...(prev[sectionKey] || [])];
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= order.length) return prev;
      const next = [...order];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return { ...prev, [sectionKey]: next };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiFetch("/admin/menu-settings", {
        method: "PUT",
        json: { menu_settings: localSettings },
      });
      updateMenuSettings(localSettings);
      toast.success("Menyinställningar sparade");
    } catch (err: any) {
      toast.error(err.message || "Kunde inte spara menyinställningar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meny inställning</h1>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meny inställning</h1>
          <p className="text-muted-foreground">
            Flytta runt knapparna så att menyn visas i rätt ordning för alla.
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Sparar..." : "Spara"}
        </Button>
      </div>

      {sections.map((section) => {
        const orderedItems = applyMenuOrder(section.items, localSettings[section.key]);
        const orderIds = localSettings[section.key] || [];
        const orderLength = orderIds.length || orderedItems.length;
        return (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle>{section.label}</CardTitle>
              <CardDescription>Justera ordningen med pilarna.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orderedItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"
                  >
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => moveItem(section.key, index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === orderLength - 1}
                        onClick={() => moveItem(section.key, index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!orderedItems.length && (
                  <div className="text-sm text-muted-foreground">Inga menyval tillgängliga.</div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default MenuSettingsPage;
