import {
  Activity, AppWindow, BarChart3, BookOpen, Building2, CreditCard, FileText, Fingerprint, Gauge, History, KeyRound,
  Layers, LayoutDashboard, type LucideIcon, Network, RadioTower, ScrollText, Send, Settings, Settings2,
  ShieldCheck, Split, Users, Webhook, Workflow,
} from "lucide-react";
import type { Permission, Role } from "@/lib/auth/permissions";
import type { MessageKey } from "@/lib/i18n/i18n";

export interface NavItem {
  id: string;
  labelKey: MessageKey;
  to: string;
  icon: LucideIcon;
  permission: Permission;
}
export interface NavGroup {
  id: string;
  labelKey?: MessageKey;
  items: NavItem[];
}

const PLATFORM_NAV: NavGroup[] = [
  { id: "home", items: [{ id: "dashboard", labelKey: "nav.dashboard", to: "/", icon: LayoutDashboard, permission: "dashboard.view" }] },
  {
    id: "clients", labelKey: "nav.group.clientManagement", items: [
      { id: "tenants", labelKey: "nav.tenants", to: "/platform/tenants", icon: Building2, permission: "platform.tenants" },
      { id: "plans", labelKey: "nav.plans", to: "/platform/plans", icon: CreditCard, permission: "platform.plans" },
      { id: "users", labelKey: "nav.usersAccess", to: "/users", icon: Users, permission: "users.view" },
    ],
  },
  {
    id: "communication", labelKey: "nav.group.communication", items: [
      { id: "messages", labelKey: "nav.messages", to: "/messages", icon: History, permission: "messages.view" },
      { id: "bulk", labelKey: "nav.bulkJobs", to: "/messages/bulk", icon: Layers, permission: "messages.bulk" },
      { id: "templates", labelKey: "nav.templates", to: "/templates", icon: FileText, permission: "templates.view" },
    ],
  },
  {
    id: "platform", labelKey: "nav.group.platform", items: [
      { id: "channels", labelKey: "nav.channels", to: "/platform/channels", icon: RadioTower, permission: "platform.channels" },
      { id: "senderIdentities", labelKey: "nav.senderIdentities", to: "/sender-identities", icon: Fingerprint, permission: "platform.senderIdentities" },
      { id: "providers", labelKey: "nav.providers", to: "/platform/providers", icon: Network, permission: "platform.providers" },
      { id: "routing", labelKey: "nav.routing", to: "/platform/routing", icon: Split, permission: "platform.routing" },
      { id: "health", labelKey: "nav.health", to: "/platform/health", icon: Activity, permission: "platform.health" },
    ],
  },
  {
    id: "integration", labelKey: "nav.group.integration", items: [
      { id: "apps", labelKey: "nav.applications", to: "/applications", icon: AppWindow, permission: "apps.view" },
      { id: "credentials", labelKey: "nav.credentials", to: "/credentials", icon: KeyRound, permission: "credentials.view" },
      { id: "apiClients", labelKey: "nav.apiClients", to: "/platform/api-clients", icon: Workflow, permission: "platform.apiClients" },
    ],
  },
  {
    id: "operations", labelKey: "nav.group.operations", items: [
      { id: "usage", labelKey: "nav.usageQuotas", to: "/usage", icon: Gauge, permission: "usage.view" },
      { id: "reports", labelKey: "nav.reports", to: "/reports", icon: BarChart3, permission: "reports.view" },
      { id: "audit", labelKey: "nav.audit", to: "/audit", icon: ScrollText, permission: "audit.view" },
      { id: "config", labelKey: "nav.config", to: "/platform/config", icon: Settings2, permission: "platform.config" },
    ],
  },
];

const CLIENT_NAV: NavGroup[] = [
  { id: "home", items: [{ id: "dashboard", labelKey: "nav.dashboard", to: "/", icon: LayoutDashboard, permission: "dashboard.view" }] },
  {
    id: "messaging", labelKey: "nav.group.messaging", items: [
      { id: "send", labelKey: "nav.send", to: "/messages/send", icon: Send, permission: "messages.send" },
      { id: "bulk", labelKey: "nav.bulk", to: "/messages/bulk", icon: Layers, permission: "messages.bulk" },
      { id: "messages", labelKey: "nav.history", to: "/messages", icon: History, permission: "messages.view" },
    ],
  },
  { id: "content", labelKey: "nav.group.content", items: [{ id: "templates", labelKey: "nav.templates", to: "/templates", icon: FileText, permission: "templates.view" }] },
  {
    id: "developers", labelKey: "nav.group.developers", items: [
      { id: "apps", labelKey: "nav.applications", to: "/applications", icon: AppWindow, permission: "apps.view" },
      { id: "credentials", labelKey: "nav.credentials", to: "/credentials", icon: KeyRound, permission: "credentials.view" },
      { id: "webhooks", labelKey: "nav.webhooks", to: "/webhooks", icon: Webhook, permission: "webhooks.view" },
      { id: "docs", labelKey: "nav.docs", to: "/docs", icon: BookOpen, permission: "docs.view" },
    ],
  },
  {
    id: "insights", labelKey: "nav.group.insights", items: [
      { id: "reports", labelKey: "nav.reports", to: "/reports", icon: BarChart3, permission: "reports.view" },
      { id: "usage", labelKey: "nav.usage", to: "/usage", icon: Gauge, permission: "usage.view" },
    ],
  },
  {
    id: "admin", labelKey: "nav.group.administration", items: [
      { id: "senderIdentities", labelKey: "nav.senderIdentities", to: "/sender-identities", icon: Fingerprint, permission: "senderIdentities.view" },
      { id: "users", labelKey: "nav.users", to: "/users", icon: Users, permission: "users.view" },
      { id: "audit", labelKey: "nav.audit", to: "/audit", icon: ShieldCheck, permission: "audit.view" },
      { id: "settings", labelKey: "nav.settings", to: "/settings", icon: Settings, permission: "settings.view" },
    ],
  },
];

export function getNavigation(role: Role, can: (p: Permission) => boolean): NavGroup[] {
  const source = role === "super_admin" ? PLATFORM_NAV : CLIENT_NAV;
  return source
    .map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) }))
    .filter((g) => g.items.length > 0);
}

/** Resolve the nav group + item that owns a pathname (longest prefix match). */
export function findNavMatch(groups: NavGroup[], pathname: string) {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of groups)
    for (const item of group.items) {
      const match = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
      if (match && (!best || item.to.length > best.item.to.length)) best = { group, item };
    }
  return best;
}
