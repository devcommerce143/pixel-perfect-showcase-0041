import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, BookOpen, Building2, ChevronRight, Languages, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, UserCog } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findNavMatch, getNavigation } from "@/config/navigation";
import { ROLES } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { useI18n, type Locale } from "@/lib/i18n/i18n";

function Breadcrumbs() {
  const { t } = useI18n();
  const { user, can } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = findNavMatch(getNavigation(user.role, can), pathname);
  const crumbs: { label: string; to?: string }[] = [];
  if (match) {
    if (match.group.labelKey) crumbs.push({ label: t(match.group.labelKey) });
    crumbs.push({ label: t(match.item.labelKey), to: match.item.to });
    const rest = pathname.slice(match.item.to.length).split("/").filter(Boolean);
    rest.forEach((seg) => crumbs.push({ label: decodeURIComponent(seg) }));
  }
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />}
              <li className={last ? "truncate font-medium text-foreground" : "truncate"}>
                {c.to && !last ? <Link to={c.to as never} className="hover:text-foreground">{c.label}</Link> : c.label}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppHeader({ collapsed, onToggleCollapse, onOpenMobile }: { collapsed: boolean; onToggleCollapse: () => void; onOpenMobile: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { user, isPlatform, setDevRole } = useSession();
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
      <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={onOpenMobile} aria-label={t("header.menu")}>
        <Menu className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden size-8 lg:inline-flex" onClick={onToggleCollapse}
        aria-label={collapsed ? t("header.expand") : t("header.collapse")}>
        {collapsed ? <PanelLeftOpen className="size-4 rtl:-scale-x-100" /> : <PanelLeftClose className="size-4 rtl:-scale-x-100" />}
      </Button>
      <Breadcrumbs />

      <div className="ms-auto flex items-center gap-1">
        <div className="relative hidden xl:block">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input placeholder={t("header.search")} aria-label={t("header.search")} className="h-8 w-80 bg-surface-subtle ps-8" />
        </div>

        <div className="mx-1 hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs text-muted-foreground md:flex">
          <Building2 className="size-3.5" aria-hidden />
          <span className="max-w-48 truncate font-medium text-foreground">{isPlatform ? t("header.allTenants") : user.tenantName}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" aria-label={t("header.language")}>
              <Languages className="size-4" /><span className="text-xs font-semibold">{locale === "en" ? "EN" : "ع"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("header.language")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ar">العربية</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild variant="ghost" size="icon" className="size-8" aria-label={t("header.help")}>
          <Link to="/docs"><BookOpen className="size-4" /></Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-8" aria-label={t("header.notifications")}>
              <Bell className="size-4" />
              <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-card" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{t("header.noNotifications")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[0.8125rem]">{t("header.notif1")}</DropdownMenuItem>
            <DropdownMenuItem className="text-[0.8125rem]">{t("header.notif2")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-1.5" aria-label={t("header.account")}>
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials}</span>
              <span className="hidden text-start leading-tight lg:block">
                <span className="block text-xs font-medium">{user.name}</span>
                <span className="block text-[0.6875rem] text-muted-foreground">{t(`role.${user.role}`)}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-caption">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 text-label"><UserCog className="size-3.5" />{t("header.switchRole")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={user.role} onValueChange={(v) => setDevRole(v as never)}>
              {ROLES.map((r) => <DropdownMenuRadioItem key={r} value={r}>{t(`role.${r}`)}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem><LogOut className="size-4 rtl:-scale-x-100" />{t("header.signOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
