export const BULK_HISTORY_STATUSES = [
  "received",
  "validating",
  "materializing",
  "processing",
  "completed",
  "cancelled",
  "completed_with_failures",
] as const;
export const BULK_HISTORY_RESULTS = [
  "OPEN",
  "SUCCEEDED",
  "PARTIAL",
  "NOTHING_ACCEPTED",
  "COMPLETED_WITH_FAILURES",
  "CANCELLED",
] as const;
export const BULK_HISTORY_STATES = ["pending", "invalid", "accepted", "skipped", "failed"] as const;
export type BulkHistoryStatus = (typeof BULK_HISTORY_STATUSES)[number];
export interface BulkHistoryQuery {
  createdFrom: string;
  createdTo: string;
  page: number;
  pageSize: number;
  applicationId?: string;
  jobId?: string;
  channel?: "sms" | "email" | "whatsapp";
  status?: BulkHistoryStatus;
}
export interface BulkHistoryItemsQuery {
  page: number;
  pageSize: number;
  state?: (typeof BULK_HISTORY_STATES)[number];
}
export interface BulkHistoryPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface BulkHistoryJob {
  id: string;
  tenantId: string;
  tenantName?: string;
  applicationId: string;
  applicationName: string;
  channel: "sms" | "email" | "whatsapp";
  mode: "SHARED" | "PERSONALIZED";
  status: BulkHistoryStatus;
  result: (typeof BULK_HISTORY_RESULTS)[number];
  itemCount: number;
  invalidCount: number;
  pendingCount: number;
  acceptedCount: number;
  skippedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
}
export interface BulkHistoryItem {
  rowNumber: number;
  state: (typeof BULK_HISTORY_STATES)[number];
  errorCode: string | null;
  messageId: string | null;
}
