import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Section } from "./PageHeader";
import { ErrorState, TableSkeleton } from "./States";
import { Button } from "@/components/ui/button";

/** Observes the persisted gate only; no grant reads, writes or worker controls. */
export function SmsPilotControlState({ actor }: { actor: SenderIdentityActor }) {
  const { t } = useI18n();
  const state = useQuery(queries.smsPilotControl(actor));
  return (
    <Section title={t("pilotState.title")}>
      <div className="space-y-3 p-4">
        <p className="text-subtle">{t("pilotState.description")}</p>
        {state.isError ? (
          <ErrorState onRetry={() => void state.refetch()} />
        ) : state.isPending ? (
          <TableSkeleton rows={1} />
        ) : (
          <>
            <p>{t(state.data.submissionsEnabled ? "pilotState.open" : "pilotState.closed")}</p>
            <Button
              variant="outline"
              disabled={state.isFetching}
              onClick={() => void state.refetch()}
            >
              {t("common.refresh")}
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}
