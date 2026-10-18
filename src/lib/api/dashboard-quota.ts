import type { QuotaPolicy, QuotaWarningBand } from "./types.ts";

/** Mock warnings stay on the local usage summary. Live mode uses the quota endpoint. */
export function dashboardQuotaSource(mode: "mock" | "live"): "mock-usage" | "live-endpoint" {
  return mode === "live" ? "live-endpoint" : "mock-usage";
}

export type QuotaWarningCopyKey =
  | "dash.quota.hardStop.80"
  | "dash.quota.hardStop.90"
  | "dash.quota.hardStop.100"
  | "dash.quota.softCap.80"
  | "dash.quota.softCap.90"
  | "dash.quota.softCap.100";

/** Selects copy for a backend band and policy. A missing policy or NONE band has no warning. */
export function quotaWarningCopyKey(policy: QuotaPolicy | null, band: QuotaWarningBand): QuotaWarningCopyKey | null {
  if (policy === null || band === "none") return null;
  if (policy === "hard_stop" && band === "80") return "dash.quota.hardStop.80";
  if (policy === "hard_stop" && band === "90") return "dash.quota.hardStop.90";
  if (policy === "hard_stop" && band === "100") return "dash.quota.hardStop.100";
  if (policy === "soft_cap" && band === "80") return "dash.quota.softCap.80";
  if (policy === "soft_cap" && band === "90") return "dash.quota.softCap.90";
  return "dash.quota.softCap.100";
}
