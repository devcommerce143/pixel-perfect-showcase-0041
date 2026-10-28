import { MessageAlert } from "@/components/app/MessageAlert";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { EmptyState, ErrorState } from "@/components/app/States";
import { quotaWarningCopyKey } from "@/lib/api/dashboard-quota";
import type {
  DashboardQuotaChannel,
  DashboardQuotaWarning,
  QuotaUsageReading,
  QuotaWarningBand,
} from "@/lib/api/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";
import { quotaPeriodEnd, quotaPresentation } from "@/lib/api/quota-presentation";
import { formatDate } from "@/lib/format";

const BAND_BAR: Record<QuotaWarningBand, string> = {
  none: "bg-primary",
  "80": "bg-warning",
  "90": "bg-danger",
  "100": "bg-danger",
};

export function LiveQuotaWarnings({
  data,
  isError,
  onRetry,
  showAll = false,
}: {
  data: DashboardQuotaWarning | undefined;
  isError: boolean;
  onRetry: () => void;
  showAll?: boolean;
}) {
  const { t, locale } = useI18n();
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!data) return <div className="m-4 h-28 animate-pulse rounded-md bg-muted" role="status" />;
  if (data.scope === "platform") return <PlatformQuotaCounts counts={data.counts} />;
  if (!data.configured) {
    return (
      <EmptyState title={t("dash.quotaUnconfiguredTitle")} body={t("dash.quotaUnconfiguredBody")} />
    );
  }
  return (
    <>
      {showAll && (
        <div className="px-4 pt-4 text-caption">
          <p>
            {t("liveUsage.currentPeriod")}:{" "}
            {formatDate(`${data.periodStart}T00:00:00.000Z`, locale)} —{" "}
            {formatDate(quotaPeriodEnd(data.periodStart), locale)} (UTC)
          </p>
          <p>{t("liveUsage.usedHint")}</p>
        </div>
      )}
      <TenantQuotaAssessment
        aggregate={data.aggregate}
        channels={data.channels}
        policy={data.policy}
        policySource={data.policySource}
        showAll={showAll}
      />
    </>
  );
}

function PlatformQuotaCounts({
  counts,
}: {
  counts: Extract<DashboardQuotaWarning, { scope: "platform" }>["counts"];
}) {
  const { t, locale } = useI18n();
  const items = [
    ["usage.at80", counts.atOrAbove80],
    ["usage.at90", counts.atOrAbove90],
    ["usage.at100", counts.atOrAbove100],
    ["dash.unconfiguredTenants", counts.unconfigured],
  ] as const;
  return (
    <dl className="grid grid-cols-2">
      {items.map(([key, count]) => (
        <div key={key} className="px-3 py-4 text-center">
          <dt className="text-caption">{t(key)}</dt>
          <dd className="mt-1 text-kpi tabular-nums">{formatNumber(count, locale)}</dd>
          <dd className="text-caption">{t("usage.tenants")}</dd>
        </div>
      ))}
    </dl>
  );
}

function TenantQuotaAssessment({
  aggregate,
  channels,
  policy,
  policySource,
  showAll,
}: {
  aggregate: QuotaUsageReading;
  channels: DashboardQuotaChannel[];
  policy: "hard_stop" | "soft_cap" | null;
  policySource: "plan" | "subscription" | null;
  showAll: boolean;
}) {
  const { t } = useI18n();
  const warnings = channels.filter((channel) => showAll || channel.band !== "none");
  return (
    <div className="flex flex-col gap-3 p-4">
      {policy ? (
        <p className="text-caption">
          {t(policy === "hard_stop" ? "dash.quotaPolicy.hardStop" : "dash.quotaPolicy.softCap")}
          {policySource
            ? ` · ${t(policySource === "plan" ? "dash.quotaPolicySource.plan" : "dash.quotaPolicySource.subscription")}`
            : ""}
        </p>
      ) : null}
      {showAll && <p className="font-medium">{t("liveUsage.aggregate")}</p>}
      <UsageReading reading={aggregate} policy={policy} showDetails={showAll} />
      {warnings.length > 0 ? (
        <div className="border-t pt-3">
          <p className="text-caption">{t("dash.quotaSeparate")}</p>
          <ul className="mt-2 flex flex-col gap-3">
            {warnings.map((channel) => (
              <li key={channel.channel}>
                <ChannelLabel channel={channel.channel} className="font-medium" />
                {showAll && !channel.enabled && (
                  <span className="ms-2 text-caption">{t("liveUsage.channelDisabled")}</span>
                )}
                <UsageReading reading={channel} policy={policy} showDetails={showAll} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UsageReading({
  reading,
  policy,
  showDetails,
}: {
  reading: QuotaUsageReading;
  policy: "hard_stop" | "soft_cap" | null;
  showDetails: boolean;
}) {
  const { t, locale } = useI18n();
  const copyKey = quotaWarningCopyKey(policy, reading.band);
  const { remaining, percentage: ratio } = quotaPresentation(reading);
  const tone =
    reading.band === "100" || reading.band === "90"
      ? "danger"
      : reading.band === "80"
        ? "warning"
        : "success";
  const showOverage = reading.overage !== null && reading.overage > 0;
  const showRemaining = !showOverage && reading.ceiling !== null && reading.used <= reading.ceiling;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-kpi">{ratio === null ? "—" : formatPercent(ratio, locale)}</span>
        <span className="text-caption tabular-nums">
          {formatNumber(reading.used, locale)} /{" "}
          {reading.ceiling === null ? "—" : formatNumber(reading.ceiling, locale)}
        </span>
      </div>
      {reading.ceiling !== null && reading.ceiling > 0 ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label={t("dash.used")}
          aria-valuemin={0}
          aria-valuenow={Math.min(reading.used, reading.ceiling)}
          aria-valuemax={reading.ceiling}
        >
          <div
            className={cn("h-full rounded-full", BAND_BAR[reading.band])}
            style={{ width: `${Math.min(ratio ?? 0, 100)}%` }}
          />
        </div>
      ) : null}
      <dl className="grid grid-cols-3 gap-2 text-table">
        <div>
          <dt className="text-caption">{t("dash.used")}</dt>
          <dd className="font-medium tabular-nums">{formatNumber(reading.used, locale)}</dd>
        </div>
        <div>
          <dt className="text-caption">{t("dash.limit")}</dt>
          <dd className="font-medium tabular-nums">
            {reading.ceiling === null
              ? showDetails
                ? t("liveUsage.noCeiling")
                : "—"
              : formatNumber(reading.ceiling, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-caption">
            {t(!showDetails && showOverage ? "dash.quotaOverageLabel" : "dash.remaining")}
          </dt>
          <dd className="font-medium tabular-nums">
            {showDetails
              ? remaining === null
                ? t("liveUsage.noCeiling")
                : formatNumber(remaining, locale)
              : showOverage
                ? formatNumber(reading.overage ?? 0, locale)
                : showRemaining
                  ? formatNumber((reading.ceiling ?? 0) - reading.used, locale)
                  : "—"}
          </dd>
        </div>
      </dl>
      {showDetails && (
        <dl className="grid grid-cols-3 gap-2 text-table">
          <div>
            <dt className="text-caption">{t("liveUsage.committed")}</dt>
            <dd>{formatNumber(reading.committed, locale)}</dd>
          </div>
          <div>
            <dt className="text-caption">{t("liveUsage.reserved")}</dt>
            <dd>{formatNumber(reading.reserved, locale)}</dd>
          </div>
          {showOverage && (
            <div>
              <dt className="text-caption">{t("dash.quotaOverageLabel")}</dt>
              <dd>{formatNumber(reading.overage ?? 0, locale)}</dd>
            </div>
          )}
        </dl>
      )}
      {showDetails && reading.ceiling === null && (
        <p className="text-caption">{t("liveUsage.noCeiling")}</p>
      )}
      {copyKey ? (
        <MessageAlert variant={tone === "danger" ? "error" : "warning"}>{t(copyKey)}</MessageAlert>
      ) : null}
    </div>
  );
}
