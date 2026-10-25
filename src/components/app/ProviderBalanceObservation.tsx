import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import {
  providerBalanceIsStale,
  type ProviderBalanceObservation as Observation,
} from "@/lib/api/provider-monitoring";

export function ProviderBalanceObservation({
  observation,
  readFailed,
}: {
  observation: Observation | null | undefined;
  readFailed: boolean;
}) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    // Update the age warning locally; this never triggers a provider/API request.
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const status = observation?.status ?? "NOT_RETRIEVED";
  const hasValue = observation?.amount !== null && observation?.amount !== undefined;
  return (
    <section
      className="m-4 space-y-3 rounded-md border p-4"
      aria-label={t("providerBalance.title")}
    >
      <h3 className="text-sm font-semibold">{t("providerBalance.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("providerBalance.note")}</p>
      <p>{t(`providerBalance.status.${status}`)}</p>
      {readFailed && <p role="alert">{t("providerBalance.readFailed")}</p>}
      {hasValue && observation && (
        <>
          {status === "FAILED" && <p role="status">{t("providerBalance.previous")}</p>}
          <p className="text-lg font-semibold">
            <bdi dir="ltr">
              {observation.amount} {observation.unit}
            </bdi>
          </p>
          <p>
            {t("providerBalance.lastSuccess")}: {formatDateTime(observation.lastSuccessAt!, locale)}
          </p>
          {providerBalanceIsStale(observation, now) && (
            <p role="alert">{t("providerBalance.stale")}</p>
          )}
        </>
      )}
      {observation?.lastAttemptAt && (
        <p>
          {t("providerBalance.lastAttempt")}: {formatDateTime(observation.lastAttemptAt, locale)}
        </p>
      )}
      {observation?.failureClass && (
        <p>
          {t("liveProviders.failure")}: {t(`liveProviders.failure.${observation.failureClass}`)}
        </p>
      )}
    </section>
  );
}
