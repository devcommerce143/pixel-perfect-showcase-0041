import assert from "node:assert/strict";
import { it } from "node:test";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { en } from "../i18n/en.ts";
import { ar } from "../i18n/ar.ts";
import { notificationKey } from "./notifications.ts";
import { NOTIFICATION_KINDS } from "./notification-contract.ts";
import { notificationCopy } from "./notification-copy.ts";
import { userErrorKey, supportReference } from "./user-message.ts";
import { ApiError } from "./http/errors.ts";

it("renders real notification UI states safely in English and Arabic without network calls", () => {
  const require = createRequire(import.meta.url),
    root = path.resolve("src");
  for (const [locale, dictionary] of [
    ["en", en],
    ["ar", ar],
  ] as const) {
    const cases = [
      ...(
        ["loading", "empty", "failed", "unread", "read", "markFailed", "allPending"] as const
      ).map((state) => ({ state, kind: "ACCESS_CHANGED" as const })),
      ...NOTIFICATION_KINDS.slice(1).map((kind) => ({ state: "unread" as const, kind })),
    ];
    for (const { state, kind } of cases) {
      const cache = new Map<string, Record<string, unknown>>();
      const fragment = ({ children }: { children?: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children);
      const button = ({
        children,
        variant: _variant,
        size: _size,
        asChild: _asChild,
        ...props
      }: Record<string, unknown>) =>
        React.createElement("button", props, children as React.ReactNode);
      const load = (name: string, from = root): Record<string, unknown> => {
        if (name === "@/lib/i18n/i18n")
          return {
            useI18n: () => ({
              locale,
              dir: locale === "ar" ? "rtl" : "ltr",
              t: (key: keyof typeof en, params?: Record<string, unknown>) =>
                dictionary[key].replace(/\{(\w+)\}/g, (_, key: string) =>
                  String(params?.[key] ?? ""),
                ),
            }),
          };
        if (name === "@/lib/auth/session")
          return {
            useSession: () => ({
              user: { id: "actor", role: "viewer", tenantId: "tenant", name: "User" },
            }),
          };
        if (name === "@/lib/api/queries")
          return {
            queries: { notifications: () => ({}) },
            notificationMutations: { markRead: () => Promise.resolve() },
          };
        if (name === "@/lib/api/notifications") return { notificationKey };
        if (name === "@/lib/api/user-message") return { userErrorKey, supportReference };
        if (name === "@/lib/format") return { formatDateTime: (value: string) => value };
        if (name === "@/components/ui/button") return { Button: button };
        if (name === "@/components/ui/popover")
          return {
            Popover: fragment,
            PopoverTrigger: fragment,
            PopoverContent: ({ children, dir }: { children?: React.ReactNode; dir: string }) =>
              React.createElement("div", { dir }, children),
          };
        if (name === "@tanstack/react-query")
          return {
            useQuery: () => ({
              isPending: state === "loading",
              isFetching: state === "loading",
              isError: state === "failed",
              isSuccess: !["loading", "failed"].includes(state),
              error: new ApiError({ statusCode: 500, message: "SECRET STACK" }),
              refetch: () => Promise.resolve(),
              data: {
                items: ["unread", "read", "markFailed", "allPending"].includes(state)
                  ? [
                      {
                        id: "hidden-id",
                        kind,
                        createdAt: "2026-10-25T00:00:00.000Z",
                        readAt: state === "read" ? "2026-10-25T00:01:00.000Z" : null,
                      },
                    ]
                  : [],
                total: state === "empty" ? 0 : 1,
                unreadCount: state === "read" || state === "empty" ? 0 : 1,
              },
            }),
            useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
            useMutation: () => ({
              isPending: state === "allPending",
              isError: state === "markFailed",
              error: new ApiError({ statusCode: 500, message: "SECRET STACK" }),
              mutate: () => undefined,
              reset: () => undefined,
            }),
          };
        if (!name.startsWith(".") && !name.startsWith("@/")) return require(name);
        const base = name.startsWith("@/")
          ? path.join(root, name.slice(2))
          : path.resolve(from, name);
        const filename = [base, base + ".tsx", base + ".ts"].find((p) => existsSync(p));
        assert.ok(filename);
        if (cache.has(filename)) return cache.get(filename)!;
        const exports: Record<string, unknown> = {};
        cache.set(filename, exports);
        const code = ts.transpileModule(readFileSync(filename, "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText;
        new Function("require", "exports", code)(
          (n: string) => load(n, path.dirname(filename)),
          exports,
        );
        return exports;
      };
      const component = load("@/components/app/Notifications")[
        "Notifications"
      ] as React.ComponentType;
      const html = renderToStaticMarkup(React.createElement(component));
      assert.doesNotMatch(html, /SECRET STACK|hidden-id/);
      assert.ok(html.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`));
      const text = (value: string) =>
        renderToStaticMarkup(React.createElement(React.Fragment, null, value));
      if (state === "empty") assert.ok(html.includes(text(dictionary["notifications.empty"])));
      if (state === "failed" || state === "markFailed") assert.ok(html.includes('role="alert"'));
      if (state === "loading") assert.ok(html.includes('aria-busy="true"'));
      if (state === "unread") assert.ok(html.includes(text(dictionary["notifications.markRead"])));
      if (state === "read") assert.ok(!html.includes(text(dictionary["notifications.markRead"])));
      const action = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
        .map((match) => match[0])
        .find((value) =>
          value.includes(
            text(
              dictionary[
                state === "allPending" ? "notifications.markingAll" : "notifications.markAllRead"
              ],
            ),
          ),
        );
      assert.ok(action);
      if (["loading", "empty", "failed", "read", "allPending"].includes(state))
        assert.ok(action.includes('disabled=""'));
      if (state === "unread") {
        assert.ok(!action.includes('disabled=""'));
        assert.ok(html.includes("line-clamp-2"));
        assert.ok(html.includes(text(dictionary[notificationCopy[kind].body])));
      }
    }
  }
});
