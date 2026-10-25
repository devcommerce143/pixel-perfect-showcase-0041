// Route inventory inspected against backend controllers on 2026-10-22.
// Documentation only: backend authorization remains authoritative.
export type ApiAudience = "machine" | "human" | "platform" | "callback" | "public";
export interface DocumentedRoute {
  method: string;
  path: string;
  audience: ApiAudience;
}
export const API_ROUTES: readonly DocumentedRoute[] = [
  {
    method: "GET",
    path: "/api/v1/provider-callbacks/meta",
    audience: "callback",
  },
  {
    method: "POST",
    path: "/api/v1/provider-callbacks/meta",
    audience: "callback",
  },
  {
    method: "GET",
    path: "/api/v1/applications",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/applications/:applicationId",
    audience: "human",
  },
  {
    method: "PATCH",
    path: "/api/v1/applications/:applicationId",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/bulk-jobs",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/bulk-jobs/:jobId/cancel",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/bulk-jobs/csv",
    audience: "human",
  },
  {
    method: "PUT",
    path: "/api/v1/applications/:applicationId/channels",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/applications/:applicationId/credentials",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/credentials",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/applications/:applicationId/credentials/:credentialId",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/credentials/:credentialId/revoke",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/credentials/:credentialId/rotate",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/messages",
    audience: "human",
  },
  {
    method: "PUT",
    path: "/api/v1/applications/:applicationId/scopes",
    audience: "human",
  },
  {
    method: "PUT",
    path: "/api/v1/applications/:applicationId/sender-access",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/status",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/applications/:applicationId/webhooks",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/webhooks",
    audience: "human",
  },
  {
    method: "DELETE",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId",
    audience: "human",
  },
  {
    method: "PATCH",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId/deliveries",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId/disable",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId/enable",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId/ping",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/applications/:applicationId/webhooks/:endpointId/secret",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/audit-events",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/audit-events/:eventId",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/auth/me",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/bulk-job-history",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/bulk-job-history/:jobId",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/bulk-job-history/:jobId/items",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/content-templates",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/content-templates",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/content-templates/:id",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/content-templates/:id/ready",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/content-templates/:id/render",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/content-templates/:id/retire",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/dashboard",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/dashboard/messages",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/dashboard/quota",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/entitlements",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/message-history",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/message-history/:messageId",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/message-history/export",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/senders",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/senders",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/senders/:senderId",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/senders/:senderId/activate",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/senders/:senderId/deactivate",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/senders/:senderId/reopen",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/senders/:senderId/submit",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/senders/:senderId/suspend",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/subscription",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/templates",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/templates",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/templates/:templateId",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/templates/:templateId/ready",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/templates/:templateId/retire",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/usage",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/usage/export",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/users",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/users",
    audience: "human",
  },
  {
    method: "GET",
    path: "/api/v1/users/:userId",
    audience: "human",
  },
  {
    method: "PATCH",
    path: "/api/v1/users/:userId",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/users/:userId/role",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/users/:userId/status",
    audience: "human",
  },
  {
    method: "POST",
    path: "/api/v1/bulk-jobs",
    audience: "machine",
  },
  {
    method: "GET",
    path: "/api/v1/bulk-jobs/:jobId",
    audience: "machine",
  },
  {
    method: "POST",
    path: "/api/v1/bulk-jobs/:jobId/cancel",
    audience: "machine",
  },
  {
    method: "GET",
    path: "/api/v1/bulk-jobs/:jobId/items",
    audience: "machine",
  },
  {
    method: "GET",
    path: "/api/v1/bulk-jobs/:jobId/results",
    audience: "machine",
  },
  {
    method: "POST",
    path: "/api/v1/bulk-jobs/csv",
    audience: "machine",
  },
  {
    method: "POST",
    path: "/api/v1/messages",
    audience: "machine",
  },
  {
    method: "GET",
    path: "/api/v1/messages/:messageId",
    audience: "machine",
  },
  {
    method: "GET",
    path: "/api/v1/plans",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/plans",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/plans/:planId",
    audience: "platform",
  },
  {
    method: "PATCH",
    path: "/api/v1/plans/:planId",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/plans/:planId/channels/:channel",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/plans/:planId/commercial-terms",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/plans/:planId/features",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/plans/:planId/status",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/api-credentials",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/applications",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/audit-events",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/audit-retention",
    audience: "platform",
  },
  {
    method: "PATCH",
    path: "/api/v1/platform/audit-retention",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/bulk-job-history",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/message-history",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/message-history/export",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/senders",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/platform/users",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId",
    audience: "platform",
  },
  {
    method: "PATCH",
    path: "/api/v1/tenants/:tenantId",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId",
    audience: "platform",
  },
  {
    method: "PATCH",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/bulk-jobs",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/bulk-jobs/:jobId/cancel",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/bulk-jobs/csv",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/channels",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/credentials",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/credentials",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/credentials/:credentialId",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/credentials/:credentialId/revoke",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/credentials/:credentialId/rotate",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/messages",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/scopes",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/sender-access",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/status",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks",
    audience: "platform",
  },
  {
    method: "DELETE",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId",
    audience: "platform",
  },
  {
    method: "PATCH",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId/deliveries",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId/disable",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId/enable",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId/ping",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/applications/:applicationId/webhooks/:endpointId/secret",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/audit-events",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/audit-events/:eventId",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/bulk-job-history",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/bulk-job-history/:jobId",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/bulk-job-history/:jobId/items",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/content-templates",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/content-templates",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/content-templates/:id",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/content-templates/:id/ready",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/content-templates/:id/render",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/content-templates/:id/retire",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/dashboard",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/data-region",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/entitlements",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/message-history",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/message-history/:messageId",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/message-history/:messageId/provider-attempts",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/message-history/export",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/messages/:messageId/unknown-resolution",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/primary-admin",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/senders",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/senders/:senderId",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/activate",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/deactivate",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/email-evidence",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/email-evidence",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/reject",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/reopen",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/review",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/submit",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/suspend",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/senders/:senderId/verify",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/status",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/subscription",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/subscription",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/subscription/cancel",
    audience: "platform",
  },
  {
    method: "DELETE",
    path: "/api/v1/tenants/:tenantId/subscription/channels/:channel",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/subscription/channels/:channel",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/subscription/history",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/subscription/overrides",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/templates",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/templates",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/templates/:templateId",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/templates/:templateId/evidence",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/templates/:templateId/ready",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/templates/:templateId/retire",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/usage",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/usage/export",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/users",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/users",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/tenants/:tenantId/users/:userId",
    audience: "platform",
  },
  {
    method: "PATCH",
    path: "/api/v1/tenants/:tenantId/users/:userId",
    audience: "platform",
  },
  {
    method: "PUT",
    path: "/api/v1/tenants/:tenantId/users/:userId/external-subject",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/users/:userId/role",
    audience: "platform",
  },
  {
    method: "POST",
    path: "/api/v1/tenants/:tenantId/users/:userId/status",
    audience: "platform",
  },
  {
    method: "GET",
    path: "/api/v1/health",
    audience: "public",
  },
];

export function documentationRoutes(all: boolean, search: string): readonly DocumentedRoute[] {
  const query = search.trim().toLowerCase();
  return API_ROUTES.filter(
    (route) =>
      (all || route.audience === "machine" || route.audience === "human") &&
      `${route.method} ${route.path} ${route.audience}`.toLowerCase().includes(query),
  );
}
