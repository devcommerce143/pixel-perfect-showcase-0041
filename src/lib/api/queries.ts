import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { ListParams } from "./types";

/** Query layer: screens consume these factories, never the API client directly. */
export const queries = {
  dashboard: () => queryOptions({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() }),
  messages: (p: ListParams) =>
    queryOptions({
      queryKey: ["messages", p],
      queryFn: () => api.listMessages(p),
      placeholderData: keepPreviousData,
    }),
  message: (id: string) => queryOptions({ queryKey: ["message", id], queryFn: () => api.getMessage(id) }),
  templates: (p: ListParams) =>
    queryOptions({
      queryKey: ["templates", p],
      queryFn: () => api.listTemplates(p),
      placeholderData: keepPreviousData,
    }),
  applications: () => queryOptions({ queryKey: ["applications"], queryFn: () => api.listApplications() }),
  credentials: () => queryOptions({ queryKey: ["credentials"], queryFn: () => api.listCredentials() }),
  audit: (p: ListParams) =>
    queryOptions({
      queryKey: ["audit", p],
      queryFn: () => api.listAuditEvents(p),
      placeholderData: keepPreviousData,
    }),
  usage: () => queryOptions({ queryKey: ["usage"], queryFn: () => api.getUsage() }),
  tenants: (p: ListParams) =>
    queryOptions({
      queryKey: ["tenants", p],
      queryFn: () => api.listTenants(p),
      placeholderData: keepPreviousData,
    }),
  providers: () => queryOptions({ queryKey: ["providers"], queryFn: () => api.listProviders() }),
  bulkJobs: () => queryOptions({ queryKey: ["bulkJobs"], queryFn: () => api.listBulkJobs() }),
  webhooks: () => queryOptions({ queryKey: ["webhooks"], queryFn: () => api.listWebhooks() }),
  users: () => queryOptions({ queryKey: ["users"], queryFn: () => api.listUsers() }),
  settings: () => queryOptions({ queryKey: ["settings"], queryFn: () => api.getSettings() }),
  report: () => queryOptions({ queryKey: ["report"], queryFn: () => api.getReport() }),
  plans: () => queryOptions({ queryKey: ["plans"], queryFn: () => api.listPlans() }),
  channels: () => queryOptions({ queryKey: ["channels"], queryFn: () => api.listChannels() }),
  routing: () => queryOptions({ queryKey: ["routing"], queryFn: () => api.listRoutingRules() }),
  platformClients: (p: ListParams) =>
    queryOptions({
      queryKey: ["platformClients", p],
      queryFn: () => api.listPlatformClients(p),
      placeholderData: keepPreviousData,
    }),
  config: () => queryOptions({ queryKey: ["config"], queryFn: () => api.listConfig() }),
};
