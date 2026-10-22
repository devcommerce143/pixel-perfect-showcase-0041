import type { DashboardSummary } from "./types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
/** Same inclusive 14 UTC calendar days as the engine dashboard; independent audit events. */
export function dashboardAuditQuery(now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    acceptedFrom: new Date(today - 13 * 86400000).toISOString(),
    acceptedTo: new Date(today + 86400000).toISOString(),
    page: 1,
    pageSize: 6,
  };
}
function csvCell(value: string | number) {
  const text = String(value);
  let first = 0;
  while (first < text.length && (text.charCodeAt(first) <= 32 || text[first]!.trim() === ""))
    first++;
  const safe = /^[=+\-@]/.test(text.slice(first)) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** Loaded aggregate only. Grouping sets overlap; no previous-window delta is invented. */
export function dashboardSummaryCsv(summary: DashboardSummary, tenantId?: string) {
  const scope = summary.scope ?? "mock";
  if (scope === "tenant" && !isTenantUuid(tenantId ?? ""))
    throw new Error("Tenant identity required for dashboard export");
  const tenant = scope === "tenant" ? tenantId! : "";
  const rows: Array<Array<string | number>> = [
    ["section", "scope", "tenant_id", "date_utc", "channel", "metric", "value"],
  ];
  const add = (section: string, date: string, channel: string, metric: string, value: number) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Invalid dashboard aggregate value");
    rows.push([section, scope, tenant, date, channel, metric, value]);
  };
  for (const [metric, value] of Object.entries({
    total: summary.kpis.total,
    delivered_and_read: summary.kpis.delivered,
    pending: summary.kpis.pending,
    failed: summary.kpis.failed,
    submitted: summary.kpis.submitted,
    unknown: summary.kpis.unknown,
  }))
    if (value !== undefined) add("current_message_statuses", "", "", metric, value);
  for (const point of summary.trend)
    for (const [metric, value] of Object.entries({
      delivered_and_read: point.delivered,
      pending: point.pending,
      failed: point.failed,
    }))
      add("daily_current_message_statuses", point.date, "", metric, value);
  for (const row of summary.channels) add("channel_messages", "", row.channel, "count", row.count);
  if (summary.quota) {
    add("loaded_quota_snapshot", "", "", "committed_units", summary.quota.used);
    add("loaded_quota_snapshot", "", "", "monthly_limit", summary.quota.limit);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
