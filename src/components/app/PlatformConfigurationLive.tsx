import { Link } from "@tanstack/react-router";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { AuditRetention } from "./AdministrativeAudit";
import { SmsPilotControlState } from "./SmsPilotControlState";

export function PlatformConfigurationLive() {
  const { user } = useSession();
  const { t } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  return (
    <>
      <PageHeader title={t("cfg.title")} description={t("livePolicy.description")} />
      <PageBody>
        <Section title={t("livePolicy.ownership")}>
          <div className="space-y-3 p-4 text-sm">
            <p>{t("livePolicy.identityPolicy")}</p>
            <p>{t("livePolicy.networkPolicy")}</p>
            <p>{t("livePolicy.channelPolicy")}</p>
            <div className="flex flex-wrap gap-4 underline">
              <Link to="/platform/channels">{t("nav.channels")}</Link>
              <Link to="/platform/plans">{t("nav.plans")}</Link>
              <Link to="/platform/tenants">{t("nav.tenants")}</Link>
              <Link to="/platform/providers" search={{ providerId: undefined }}>
                {t("nav.providers")}
              </Link>
              <Link to="/platform/routing">{t("nav.routing")}</Link>
              <Link to="/audit">{t("nav.audit")}</Link>
            </div>
          </div>
        </Section>
        <AuditRetention actor={actor} />
        <SmsPilotControlState actor={actor} />
      </PageBody>
    </>
  );
}
