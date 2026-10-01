/**
 * Centralized role → permission model for the presentation layer.
 * The backend remains the authority for authorization; the UI only uses this
 * to hide modules a role should not see.
 */
export type Role = "super_admin" | "client_admin" | "operator" | "viewer";

export type Permission =
  | "dashboard.view"
  | "messages.view"
  | "messages.send"
  | "messages.bulk"
  | "templates.view"
  | "templates.manage"
  | "apps.view"
  | "apps.manage"
  | "credentials.view"
  | "credentials.manage"
  | "webhooks.view"
  | "reports.view"
  | "usage.view"
  | "users.view"
  | "audit.view"
  | "settings.view"
  | "docs.view"
  | "platform.tenants"
  | "platform.plans"
  | "platform.channels"
  | "platform.providers"
  | "platform.routing"
  | "platform.health"
  | "platform.apiClients"
  | "platform.config";

const CLIENT_ADMIN: Permission[] = [
  "dashboard.view",
  "messages.view",
  "messages.send",
  "messages.bulk",
  "templates.view",
  "templates.manage",
  "apps.view",
  "apps.manage",
  "credentials.view",
  "credentials.manage",
  "webhooks.view",
  "reports.view",
  "usage.view",
  "users.view",
  "audit.view",
  "settings.view",
  "docs.view",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>([
    "dashboard.view",
    "messages.view",
    "messages.bulk",
    "templates.view",
    "apps.view",
    "reports.view",
    "usage.view",
    "users.view",
    "audit.view",
    "docs.view",
    "platform.tenants",
    "platform.plans",
    "platform.channels",
    "platform.providers",
    "platform.routing",
    "platform.health",
    "platform.apiClients",
    "platform.config",
  ]),
  client_admin: new Set(CLIENT_ADMIN),
  operator: new Set<Permission>([
    "dashboard.view",
    "messages.view",
    "messages.send",
    "messages.bulk",
    "templates.view",
    "reports.view",
    "usage.view",
    "docs.view",
  ]),
  viewer: new Set<Permission>([
    "dashboard.view",
    "messages.view",
    "templates.view",
    "reports.view",
    "usage.view",
    "audit.view",
    "docs.view",
  ]),
};

export const ROLES: Role[] = ["super_admin", "client_admin", "operator", "viewer"];

export function roleHas(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}
