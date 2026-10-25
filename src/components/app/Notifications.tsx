import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { queries, notificationMutations } from "@/lib/api/queries";
import { notificationKey } from "@/lib/api/notifications";
import { notificationCopy } from "@/lib/api/notification-copy";
import type { SenderIdentityActor } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "./States";

export function Notifications() {
  const { user } = useSession();
  if (!user) return null;
  const actor = { userId: user.id, role: user.role, tenantId: user.tenantId, name: user.name };
  return (
    <PersonalNotifications
      key={JSON.stringify(notificationKey(actor).slice(0, -1))}
      actor={actor}
    />
  );
}

function PersonalNotifications({ actor }: { actor: SenderIdentityActor }) {
  const { t, locale, dir } = useI18n();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const writing = useRef(false);
  const inbox = useQuery(queries.notifications(actor, page));
  const read = useMutation({
    mutationKey: [...notificationKey(actor).slice(0, -1), "read"],
    mutationFn: notificationMutations.markRead,
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notificationKey(actor).slice(0, -1) });
    },
    onSettled: () => {
      writing.current = false;
    },
  });
  const readAll = useMutation({
    mutationKey: [...notificationKey(actor).slice(0, -1), "read-all"],
    mutationFn: notificationMutations.markAllRead,
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notificationKey(actor).slice(0, -1) });
    },
    onSettled: () => {
      writing.current = false;
    },
  });
  const isWriting = read.isPending || readAll.isPending;
  const unread = inbox.isSuccess ? inbox.data.unreadCount : null;
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          if (!writing.current) {
            read.reset();
            readAll.reset();
          }
          void inbox.refetch();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label={
            unread === null
              ? t("header.notifications")
              : t("notifications.unreadCount", { count: unread })
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread !== null && unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute end-0 top-0 rounded-full bg-danger px-1 text-[10px] text-primary-foreground"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={t("header.notifications")}
        align="end"
        dir={dir}
        className="w-96 max-w-[calc(100vw-2rem)] p-0 text-start"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h2 className="font-semibold">{t("header.notifications")}</h2>
          <Button
            size="sm"
            disabled={unread === null || unread === 0 || inbox.isFetching || isWriting}
            aria-busy={readAll.isPending}
            onClick={() => {
              if (writing.current || !inbox.isSuccess || inbox.data.unreadCount === 0) return;
              writing.current = true;
              read.reset();
              readAll.mutate();
            }}
          >
            {t(readAll.isPending ? "notifications.markingAll" : "notifications.markAllRead")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={inbox.isFetching || isWriting}
            onClick={() => void inbox.refetch()}
          >
            {t("common.refresh")}
          </Button>
        </div>
        <div className="max-h-[65svh] overflow-y-auto" aria-busy={inbox.isFetching}>
          {inbox.isPending ? (
            <TableSkeleton rows={2} />
          ) : inbox.isError ? (
            <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
          ) : !inbox.data.items.length ? (
            <EmptyState title={t("notifications.empty")} body={t("notifications.emptyBody")} />
          ) : (
            <ul className="divide-y">
              {inbox.data.items.map((item) => (
                <li key={item.id} className="space-y-2 p-3">
                  <p className="line-clamp-1 break-words font-medium">
                    {t(notificationCopy[item.kind].title)}
                  </p>
                  <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                    {t(notificationCopy[item.kind].body)}
                  </p>
                  <time className="block text-xs text-muted-foreground" dateTime={item.createdAt}>
                    {formatDateTime(item.createdAt, locale)}
                  </time>
                  {item.readAt === null ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isWriting || inbox.isFetching}
                      onClick={() => {
                        if (writing.current) return;
                        writing.current = true;
                        readAll.reset();
                        read.mutate(item.id);
                      }}
                    >
                      {t("notifications.markRead")}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("notifications.read")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(read.isError || readAll.isError) && (
            <ErrorState error={readAll.isError ? readAll.error : read.error} />
          )}
        </div>
        {inbox.isSuccess && inbox.data.total > 20 && (
          <div className="flex items-center justify-between border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1 || inbox.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page * 20 >= inbox.data.total || inbox.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
