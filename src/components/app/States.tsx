import type { LucideIcon } from "lucide-react";
import { CalendarClock, Inbox, Lock } from "lucide-react";
import { MessageAlert } from "./MessageAlert";
import { userErrorKey, supportReference } from "@/lib/api/user-message";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-card-title">{title}</p>
      {body && <p className="text-subtle max-w-md">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, error }: { onRetry?: () => void; error?: unknown }) {
  const { t } = useI18n();
  return (
    <div className="p-4">
      <MessageAlert>
        <p>{t(userErrorKey(error))}</p>
        {supportReference(error) && (
          <p className="mt-2 break-all">
            {t("notice.reference")}: <bdi dir="ltr">{supportReference(error)}</bdi>
          </p>
        )}
        {onRetry && (
          <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        )}
      </MessageAlert>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function ForbiddenState() {
  const { t } = useI18n();
  return (
    <div className="p-6">
      <div className="panel">
        <EmptyState
          icon={Lock}
          title={t("common.forbiddenTitle")}
          body={t("common.forbiddenBody")}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/">{t("common.backToDashboard")}</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function ScheduledState() {
  const { t } = useI18n();
  return (
    <div className="panel">
      <EmptyState
        icon={CalendarClock}
        title={t("common.scheduledTitle")}
        body={t("common.scheduledBody")}
      />
    </div>
  );
}
