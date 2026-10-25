import assert from "node:assert/strict";
import { it } from "node:test";
import { NOTIFICATION_KINDS, validateNotification } from "./notification-contract.ts";
import { notificationCopy } from "./notification-copy.ts";
import { mapNotificationPage } from "./notifications.ts";
import { en } from "../i18n/en.ts";
import { ar } from "../i18n/ar.ts";

it("validates every event and provides deliberate English/Arabic copy", () => {
  for (const kind of NOTIFICATION_KINDS) {
    const context = kind === "QUOTA_THRESHOLD" ? { threshold: 80 } : {};
    const event = validateNotification(kind, context);
    for (const dictionary of [en, ar]) {
      assert.ok(dictionary[notificationCopy[event.kind].title]);
      assert.ok(dictionary[notificationCopy[event.kind].body]);
    }
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      ...event,
      createdAt: "2026-10-25T00:00:00.000Z",
      readAt: null,
    };
    assert.deepEqual(
      mapNotificationPage({ items: [row], page: 1, pageSize: 20, total: 1, unreadCount: 1 }, 1)
        .items[0],
      row,
    );
  }
});
it("rejects unknown kinds, raw payloads, credentials, invalid context and trailing terminators", () => {
  assert.throws(() => validateNotification("NEW_KIND"));
  for (const context of [
    { token: "secret" },
    { body: "private" },
    { recipient: "private" },
    { channel: "SMS\n" },
    { threshold: 80 },
    { targetTenantId: "11111111-1111-4111-8111-111111111111\n" },
  ])
    assert.throws(() => validateNotification("MESSAGE_FAILED", context));
  assert.throws(() => validateNotification("QUOTA_THRESHOLD", {}));
  assert.throws(() => validateNotification("ACCESS_CHANGED", { channel: "SMS" }));
});
