import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import { humanName, type NamedEntity } from "@/lib/api/entity-names";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";

export function useEntityName(
  kind: NamedEntity,
  id: string | null | undefined,
  tenantId?: string,
  name?: string | null,
) {
  const { user, status } = useSession();
  const { tenantId: selectedTenant } = useGlobalTenantContext();
  const { t } = useI18n();
  const target = tenantId ?? selectedTenant;
  const actor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const known =
    humanName(name) ??
    (kind === "tenant" && id === user?.tenantId ? humanName(user?.tenantName) : null);
  const result = useQuery(
    queries.entityName(actor, kind, id ?? "", target, status === "authenticated" && !known),
  );
  return (
    known ??
    (result.isSuccess ? humanName(result.data) : null) ??
    t(result.isFetching ? "entity.loading" : "entity.unavailable")
  );
}

export function EntityName({
  kind,
  id,
  tenantId,
  name,
}: {
  kind: NamedEntity;
  id?: string | null | undefined;
  tenantId?: string | undefined;
  name?: string | null | undefined;
}) {
  return <>{useEntityName(kind, id, tenantId, name)}</>;
}
