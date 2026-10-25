import type { SenderIdentityActor } from "./types.ts";
import {
  validateNotification,
  type NotificationKind,
  type NotificationContext,
} from "./notification-contract.ts";

export type InAppNotification = {
  id: string;
  kind: NotificationKind;
  context?: NotificationContext;
  createdAt: string;
  readAt: string | null;
};
export type NotificationPage = {
  items: InAppNotification[];
  page: number;
  pageSize: 20;
  total: number;
  unreadCount: number;
};
export function notificationKey(actor: SenderIdentityActor, page = 1) {
  return ["notifications", actor.userId, actor.role, actor.tenantId, page] as const;
}
export function notificationId(id: string) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?![\s\S])/i.test(id))
    throw new Error("Invalid notification identifier");
  return id;
}
export function notificationPageNumber(page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
    throw new Error("Invalid notification page");
  return page;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid notification response");
  return value as Record<string, unknown>;
}
function date(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error("Invalid notification date");
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid notification count");
  return value;
}
export function mapNotificationRead(body: unknown, id: string) {
  const value = record(body);
  if (value["id"] !== notificationId(id)) throw new Error("Notification mismatch");
  return { id, readAt: date(value["readAt"]) };
}
export function mapNotificationsReadAll(body: unknown) {
  return { updatedCount: count(record(body)["updatedCount"]) };
}
export function mapNotificationPage(body: unknown, page: number): NotificationPage {
  const value = record(body);
  if (
    value["page"] !== notificationPageNumber(page) ||
    value["pageSize"] !== 20 ||
    !Array.isArray(value["items"]) ||
    value["items"].length > 20
  )
    throw new Error("Invalid notification page");
  const total = count(value["total"]),
    unreadCount = count(value["unreadCount"]);
  if (unreadCount > total || value["items"].length > total)
    throw new Error("Invalid notification totals");
  const items = value["items"].map((item): InAppNotification => {
    const row = record(item);
    if (typeof row["id"] !== "string") throw new Error("Unsupported notification");
    const event = validateNotification(
      row["kind"],
      row["context"] ?? (row["kind"] === "ACCESS_CHANGED" ? {} : null),
    );
    const createdAt = date(row["createdAt"]),
      readAt = row["readAt"] === null ? null : date(row["readAt"]);
    if (readAt !== null && Date.parse(readAt) < Date.parse(createdAt))
      throw new Error("Invalid read time");
    return { id: notificationId(row["id"]), ...event, createdAt, readAt };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error("Duplicate notification");
  return { items, page, pageSize: 20, total, unreadCount };
}
