import type { Channel, MessageHistoryStatus, SenderIdentityActor } from "./types.ts";

export interface UsageReportRange {
  acceptedFrom: string;
  acceptedTo: string;
}
export interface LiveUsageReport extends UsageReportRange {
  messageCounts: {
    byStatus: { status: MessageHistoryStatus; count: number }[];
    byChannel: { channel: Channel; count: number }[];
    byApplication: {
      applicationId: string;
      channel: Channel;
      status: MessageHistoryStatus;
      count: number;
    }[];
  };
  quota: {
    periodStart: string;
    counterScope: "AGGREGATE" | "SMS" | "EMAIL" | "WHATSAPP";
    reservedCount: number;
    committedCount: number;
  }[];
}
export function usageReportKey(
  actor: SenderIdentityActor,
  range: UsageReportRange | null,
  tenantId?: string,
) {
  return [
    "usageReport",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
    range,
  ] as const;
}

/** Exports only the loaded aggregate response; rows from different sections are not additive. */
export function usageReportCsv(report: LiveUsageReport): string {
  const cell = (value: string | number) => {
    const text = String(value),
      safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows: (string | number)[][] = [
    [
      "section",
      "accepted_from",
      "accepted_to",
      "month_utc",
      "application_id",
      "channel_or_scope",
      "current_status",
      "message_count",
      "reserved_units",
      "committed_units",
    ],
    ...report.messageCounts.byStatus.map((row) => [
      "by_status",
      report.acceptedFrom,
      report.acceptedTo,
      "",
      "",
      "",
      row.status,
      row.count,
      "",
      "",
    ]),
    ...report.messageCounts.byChannel.map((row) => [
      "by_channel",
      report.acceptedFrom,
      report.acceptedTo,
      "",
      "",
      row.channel,
      "",
      row.count,
      "",
      "",
    ]),
    ...report.messageCounts.byApplication.map((row) => [
      "by_application",
      report.acceptedFrom,
      report.acceptedTo,
      "",
      row.applicationId,
      row.channel,
      row.status,
      row.count,
      "",
      "",
    ]),
    ...report.quota.map((row) => [
      "whole_month_quota",
      report.acceptedFrom,
      report.acceptedTo,
      row.periodStart,
      "",
      row.counterScope,
      "",
      "",
      row.reservedCount,
      row.committedCount,
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
