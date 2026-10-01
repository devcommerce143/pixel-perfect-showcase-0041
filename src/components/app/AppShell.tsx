import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

const KEY = "dc.sidebarCollapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { dir, t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setCollapsed(window.localStorage.getItem(KEY) === "1"), []);
  const toggle = () => setCollapsed((c) => {
    window.localStorage.setItem(KEY, c ? "0" : "1");
    return !c;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block", collapsed ? "w-16" : "w-60")}>
        <AppSidebar collapsed={collapsed} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">{t("app.name")}</SheetTitle>
          <AppSidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader collapsed={collapsed} onToggleCollapse={toggle} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
