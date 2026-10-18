/**
 * Backend payload from `GET /api/v1/dashboard/messages`.
 * Channel and status values stay in the engine vocabulary.
 */

export interface BackendDashboardRecentMessage {
  id: string;
  channel: string;
  status: string;
  acceptedAt: string;
  applicationName: string;
  templateKey: string | null;
  tenantId: string;
  tenantName: string;
  recipient?: string;
}

export interface BackendDashboardRecentMessages {
  scope: "platform" | "tenant";
  tenantId: string | null;
  items: BackendDashboardRecentMessage[];
}
