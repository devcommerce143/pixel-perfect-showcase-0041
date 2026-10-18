/**
 * Backend dashboard payload from `GET /api/v1/dashboard`.
 * These names stay in the engine's vocabulary. Presentation types live in `types.ts`.
 */

export interface BackendDashboardMessageCounts {
  total: number;
  delivered: number;
  pending: number;
  failed: number;
  unknown: number;
  submitted: number;
}

export interface BackendDashboardTrendPoint {
  date: string;
  delivered: number;
  failed: number;
  pending: number;
}

export interface BackendDashboardChannelCount {
  channel: string;
  count: number;
}

export interface BackendDashboardUsageChannel {
  channel: string;
  committedCount: number;
  reservedCount: number;
  monthlyQuota: number | null;
}

export interface BackendDashboardSummary {
  scope: "platform" | "tenant";
  tenantId: string | null;
  range: { from: string; to: string };
  messages: BackendDashboardMessageCounts;
  trend: BackendDashboardTrendPoint[];
  channels: BackendDashboardChannelCount[];
  usage: {
    periodStart: string;
    channels: BackendDashboardUsageChannel[];
    aggregate: {
      committedCount: number;
      reservedCount: number;
      monthlyQuota: number | null;
    };
  };
}
