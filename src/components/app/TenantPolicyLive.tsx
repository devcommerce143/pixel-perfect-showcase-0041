import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import type {
  SenderIdentityActor,
  EntitlementBlocker,
  EntitlementValueSource,
} from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { isTenantUuid } from "@/lib/api/http/tenant-mapper";
import { formatNumber } from "@/lib/format";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { ErrorState, EmptyState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { ChannelLabel } from "./ChannelLabel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const blockers = {
  TENANT_SUSPENDED: "ten.blockerTenantSuspended",
  TENANT_INACTIVE: "ten.blockerTenantInactive",
  SUBSCRIPTION_MISSING: "ten.blockerSubscriptionMissing",
  SUBSCRIPTION_PENDING: "ten.blockerSubscriptionPending",
  SUBSCRIPTION_CANCELLED: "ten.blockerSubscriptionCancelled",
  SUBSCRIPTION_NOT_STARTED: "ten.blockerSubscriptionNotStarted",
  SUBSCRIPTION_ENDED: "ten.blockerSubscriptionEnded",
} satisfies Record<EntitlementBlocker, MessageKey>;
const sources = {
  plan: "ten.sourcePlan",
  subscription: "ten.sourceSubscription",
  channel: "ten.sourceChannel",
  unavailable: "ten.sourceUnavailable",
} satisfies Record<EntitlementValueSource, MessageKey>;

export function TenantPolicyLive({ view }: { view: "settings" | "channels" }) {
  const { user, isPlatform } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t, locale, setLocale } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const target = isPlatform ? tenantId : actor.tenantId;
  const policy = useQuery(queries.tenantPolicy(actor, tenantId));
  const number = (value: number | null) =>
    value === null ? t("ten.unavailable") : formatNumber(value, locale);
  return (
    <>
      <PageHeader
        title={t(view === "settings" ? "set.title" : "ch.title")}
        description={t("livePolicy.description")}
      />
      <PageBody>
        {view === "settings" && (
          <>
            <Section title={t("livePolicy.preferences")}>
              <div className="grid gap-2 p-4 sm:max-w-sm">
                <Label htmlFor="portal-language">{t("livePolicy.language")}</Label>
                <Select value={locale} onValueChange={(value) => setLocale(value as "en" | "ar")}>
                  <SelectTrigger id="portal-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("livePolicy.english")}</SelectItem>
                    <SelectItem value="ar">{t("livePolicy.arabic")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-caption">{t("livePolicy.localPreference")}</p>
              </div>
            </Section>
            <Section title={t("set.security")}>
              <div className="space-y-2 p-4 text-sm">
                <p>{t("livePolicy.identityPolicy")}</p>
                <p>{t("livePolicy.networkPolicy")}</p>
                <p>{t("livePolicy.retention")}</p>
              </div>
            </Section>
          </>
        )}
        <Section title={t("ten.effectiveEntitlements")}>
          <div className="space-y-4 p-4">
            <p className="text-sm text-subtle">{t("livePolicy.channelPolicy")}</p>
            {!isTenantUuid(target ?? "") ? (
              <EmptyState title={t("livePolicy.selectTenant")} />
            ) : policy.isError ? (
              <ErrorState onRetry={() => void policy.refetch()} />
            ) : policy.isPending ? (
              <TableSkeleton />
            ) : (
              <>
                <p className="font-mono text-xs">{policy.data.effective.tenantId}</p>
                {policy.data.subscription ? (
                  <p>
                    {policy.data.subscription.plan.name}{" "}
                    <StatusBadge status={policy.data.subscription.status} />
                  </p>
                ) : (
                  <p>{t("ten.noCurrentSubscription")}</p>
                )}
                <p>
                  {t(
                    policy.data.effective.operational
                      ? "livePolicy.operational"
                      : "livePolicy.blocked",
                  )}
                </p>
                <ul className="list-disc ps-5 text-sm">
                  {policy.data.effective.blockers.map((code) => (
                    <li key={code}>{t(blockers[code])}</li>
                  ))}
                </ul>
                <dl className="grid gap-4 sm:grid-cols-3">
                  {policy.data.effective.channels.map((channel) => (
                    <div key={channel.channel} className="space-y-2 rounded border p-3">
                      <dt>
                        <ChannelLabel channel={channel.channel} />
                      </dt>
                      <dd>
                        <StatusBadge status={channel.enabled ? "active" : "disabled"} />
                      </dd>
                      <dd>
                        {t("plans.monthlyQuota")}: {number(channel.monthlyQuota)} (
                        {t(sources[channel.quotaSource])})
                      </dd>
                      <dd>
                        {t("ten.tps")}: {number(channel.tpsLimit)} ({t(sources[channel.tpsSource])})
                      </dd>
                      {channel.ignoredOverride && (
                        <dd className="text-caption">{t("ten.ignoredOverride")}</dd>
                      )}
                    </div>
                  ))}
                </dl>
                <Button
                  variant="outline"
                  disabled={policy.isFetching}
                  onClick={() => void policy.refetch()}
                >
                  {t("common.refresh")}
                </Button>
              </>
            )}
            {isPlatform && (
              <div className="flex flex-wrap gap-4 text-sm underline">
                <Link to="/platform/plans">{t("nav.plans")}</Link>
                <Link to="/platform/tenants">{t("nav.tenants")}</Link>
                <Link to="/platform/health">{t("nav.health")}</Link>
              </div>
            )}
          </div>
        </Section>
      </PageBody>
    </>
  );
}
