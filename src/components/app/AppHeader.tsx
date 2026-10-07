import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Building2, Check, ChevronDown, ChevronRight, Languages, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findNavMatch, getNavigation } from "@/config/navigation";
import { queries } from "@/lib/api/queries";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type Locale } from "@/lib/i18n/i18n";

function Breadcrumbs() {
  const { t } = useI18n();
  const { user, can } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!user) return null;
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
  const { user, isPlatform, can, signOut } = useSession();
  const { tenantId, setTenantId } = useGlobalTenantContext();
  const router = useRouter();
  const [tenantSelectorOpen, setTenantSelectorOpen] = useState(false);
  const tenantsQuery = useQuery({
    ...queries.tenants({ page: 1, pageSize: 100, filters: { status: "all" }, sortBy: "name", sortDirection: "asc" }),
    enabled: isPlatform,
  });
  const selectableTenants = (tenantsQuery.data?.items ?? []).filter((tenant) => tenant.status === "active" || tenant.status === "trial");
  const selectedTenant = selectableTenants.find((tenant) => tenant.id === tenantId);
  useEffect(() => {
    if (isPlatform && tenantId && tenantsQuery.data && !selectableTenants.some((tenant) => tenant.id === tenantId)) setTenantId(undefined);
  }, [isPlatform, selectableTenants, setTenantId, tenantId, tenantsQuery.data]);
  if (!user) return null;
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const organizationName = user.tenantName ?? t("header.dolftech");
  const accountTarget = can("settings.view") ? "/settings" : can("platform.config") ? "/platform/config" : null;
  const handleSignOut = async () => {
    await signOut();
    await router.navigate({ to: "/login" as never, replace: true });
  };

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

        {isPlatform ? (
          <Popover open={tenantSelectorOpen} onOpenChange={setTenantSelectorOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="mx-1 h-8 min-w-0 max-w-40 gap-1.5 px-2 sm:max-w-56" aria-label={t("header.tenantContext")}>
                <Building2 className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate text-xs font-medium">{selectedTenant?.name ?? (tenantId || t("header.allTenants"))}</span>
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-0">
              <Command>
                <CommandInput placeholder={t("header.searchTenants")} aria-label={t("header.searchTenants")} />
                <CommandList>
                  <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value={t("header.allTenants")} onSelect={() => { setTenantId(undefined); setTenantSelectorOpen(false); }}>
                      <Check className={`size-4 ${tenantId ? "opacity-0" : ""}`} aria-hidden />
                      {t("header.allTenants")}
                    </CommandItem>
                  </CommandGroup>
                  <CommandGroup>
                    {selectableTenants.map((tenant) => (
                      <CommandItem key={tenant.id} value={`${tenant.name} ${tenant.id}`} onSelect={() => { setTenantId(tenant.id); setTenantSelectorOpen(false); }}>
                        <Check className={`size-4 ${tenant.id === tenantId ? "opacity-100" : "opacity-0"}`} aria-hidden />
                        <span className="truncate">{tenant.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="mx-1 flex h-8 min-w-0 max-w-40 items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground sm:max-w-56 sm:px-2.5">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-medium text-foreground">{organizationName}</span>
          </div>
        )}

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
            <DropdownMenuLabel className="font-normal text-caption">{organizationName}</DropdownMenuLabel>
            {accountTarget && <DropdownMenuItem asChild><Link to={accountTarget as never}>{t("header.accountSettings")}</Link></DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleSignOut(); }}><LogOut className="size-4 rtl:-scale-x-100" />{t("header.signOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
