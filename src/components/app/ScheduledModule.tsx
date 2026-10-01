import type { Permission } from "@/lib/auth/permissions";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { PageBody, PageHeader } from "./PageHeader";
import { RequirePermission } from "./RequirePermission";
import { ScheduledState } from "./States";

/** Shell for modules whose navigation/permissions exist but screens are delivered later. */
export function ScheduledModule({ titleKey, permission }: { titleKey: MessageKey; permission: Permission }) {
  const { t } = useI18n();
  return (
    <RequirePermission permission={permission}>
      <PageHeader title={t(titleKey)} />
      <PageBody><ScheduledState /></PageBody>
    </RequirePermission>
  );
}
