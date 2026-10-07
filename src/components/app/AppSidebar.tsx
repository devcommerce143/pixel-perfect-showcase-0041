import { Link, useRouterState } from "@tanstack/react-router";
import { getNavigation, findNavMatch } from "@/config/navigation";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AppSidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t, dir } = useI18n();
  const { user, can, isPlatform } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!user) return null;
  const groups = getNavigation(user.role, can);
  const active = findNavMatch(groups, pathname);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm">
          <img src="/connect-logo.png" alt="" aria-hidden="true" className="size-8 object-contain" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-sidebar-accent-foreground">{t("app.name")}</div>
            <div className="truncate text-[0.6875rem] text-sidebar-muted">
              {isPlatform ? t("header.platform") : user.tenantName}
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto py-3" aria-label={t("app.name")}>
        {groups.map((group) => (
          <div key={group.id} className="mb-3 px-2">
            {group.labelKey && !collapsed && (
              <div className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-sidebar-muted">{t(group.labelKey)}</div>
            )}
            {group.labelKey && collapsed && <div className="mx-2 mb-2 border-t border-sidebar-border" />}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = active?.item.id === item.id;
                const Icon = item.icon;
                const link = (
                  <Link
                    to={item.to as never}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex h-8 items-center gap-2.5 rounded-md text-[0.8125rem] transition-colors",
                      collapsed ? "justify-center px-0" : "px-2",
                      isActive
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:start-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-muted")} aria-hidden />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
                return (
                  <li key={item.id}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side={dir === "rtl" ? "left" : "right"}>{t(item.labelKey)}</TooltipContent>
                      </Tooltip>
                    ) : link}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-2.5 text-[0.6875rem] text-sidebar-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sidebar-primary" aria-hidden />
            {t("app.env")} · v0.1
          </span>
        </div>
      )}
    </div>
  );
}
