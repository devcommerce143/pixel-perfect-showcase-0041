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
  | "messages.bulk.monitor"
  | "messages.bulk.cancel"
  | "messages.bulk.create"
  | "messages.bulk"
  | "templates.view"
  | "templates.manage"
  | "platform.templates.manage"
  | "apps.view"
  | "apps.manage"
  | "credentials.view"
  | "credentials.manage"
  | "platform.credentials.manage"
  | "webhooks.view"
  | "webhooks.manage"
  | "platform.webhooks.manage"
  | "users.manage"
  | "settings.manage"
  | "reports.view"
  | "usage.view"
  | "users.view"
  | "audit.view"
  | "settings.view"
  | "docs.view"
  | "platform.tenants"
  | "platform.tenants.manage"
  | "platform.plans"
  | "platform.plans.manage"
  | "platform.channels"
  | "platform.channels.manage"
  | "platform.providers"
  | "platform.providers.manage"
  | "platform.routing"
  | "platform.routing.manage"
  | "platform.health"
  | "platform.apiClients"
  | "platform.apiClients.manage"
  | "platform.config"
  | "platform.config.manage"
  | "platform.messages.resolveUnknown"
  | "platform.messages.submit"
  | "senderIdentities.view"
  | "senderIdentities.request"
  | "platform.senderIdentities"
  | "platform.senderIdentities.manage";

const CLIENT_ADMIN: Permission[] = [
  "messages.bulk.cancel",
  "messages.bulk.create",
  "dashboard.view",
  "messages.view",
  "messages.bulk.monitor",
  "messages.send",
  "messages.bulk",
  "templates.view",
  "templates.manage",
  "apps.view",
  "apps.manage",
  "credentials.view",
  "credentials.manage",
  "webhooks.view",
  "webhooks.manage",
  "users.manage",
  "settings.manage",
  "reports.view",
  "usage.view",
  "users.view",
  "audit.view",
  "settings.view",
  "docs.view",
  "senderIdentities.view",
  "senderIdentities.request",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>([
    "messages.bulk.cancel",
    "messages.bulk.create",
    "platform.messages.submit",
    "platform.messages.resolveUnknown",
    "webhooks.view",
    "platform.webhooks.manage",
    "platform.credentials.manage",
    "platform.templates.manage",
    "dashboard.view",
    "messages.view",
    "messages.bulk.monitor",
    "messages.bulk",
    "templates.view",
    "apps.view",
    "apps.manage",
    "credentials.view",
    "reports.view",
    "usage.view",
    "users.view",
    "audit.view",
    "docs.view",
    "platform.tenants",
    "platform.tenants.manage",
    "users.manage",
    "platform.plans",
    "platform.plans.manage",
    "platform.channels",
    "platform.channels.manage",
    "platform.providers",
    "platform.providers.manage",
    "platform.routing",
    "platform.routing.manage",
    "platform.health",
    "platform.apiClients",
    "platform.apiClients.manage",
    "platform.config",
    "platform.config.manage",
    "senderIdentities.view",
    "platform.senderIdentities",
    "platform.senderIdentities.manage",
  ]),
  client_admin: new Set(CLIENT_ADMIN),
  operator: new Set<Permission>([
    "messages.bulk.cancel",
    "messages.bulk.create",
    "dashboard.view",
    "messages.view",
    "messages.bulk.monitor",
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
    "messages.bulk.monitor",
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
