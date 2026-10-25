import { MessageAlert } from "@/components/app/MessageAlert";
import { useEffect, useRef, useState } from "react";
import { EntityName } from "./EntityName";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queries, liveApplicationMutations } from "@/lib/api/queries";
import { applicationMutationFailureKey } from "@/lib/api/application-mutations";
import type { LiveApplicationMutation } from "@/lib/api/application-mutations";
import type { Application, Channel, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ErrorState, TableSkeleton, EmptyState } from "./States";

const channelsList: Channel[] = ["sms", "email", "whatsapp"];
const scopesList = ["messages:send", "messages:read", "templates:read", "webhooks:manage"];
export function ApplicationCredentialsLink({ application }: { application: Application }) {
  const { isPlatform } = useSession();
  const { t } = useI18n();
  return (
    <Button asChild variant="outline">
      <Link
        to="/credentials"
        search={(previous) => ({
          ...previous,
          applicationId: application.id,
          ...(isPlatform ? { tenantId: application.tenantId } : {}),
        })}
      >
        {t("liveApplications.credentials")}
      </Link>
    </Button>
  );
}
type Action = LiveApplicationMutation["kind"];
export function LiveApplicationActions({
  application,
  tenantId,
  onSaved,
}: {
  application?: Application | undefined;
  tenantId?: string | undefined;
  onSaved: (saved: Application) => void;
}) {
  const { user, can, isPlatform } = useSession();
  const { t } = useI18n();
  const actor: SenderIdentityActor = {
    role: user?.role ?? "viewer",
    userId: user?.id ?? "",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<Application["environment"]>("production");
  const [status, setStatus] = useState<Application["status"]>("active");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [senderAccess, setSenderAccess] = useState<"all_eligible" | "allow_list">("allow_list");
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [senderPage, setSenderPage] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const qc = useQueryClient();
  const senderQuery = useQuery(
    queries.applicationSenderOptions(
      actor,
      senderPage,
      tenantId,
      (action === "create" || action === "sender-access") && senderAccess === "allow_list",
    ),
  );
  const mutation = useMutation({
    retry: false,
    mutationFn: (operation: LiveApplicationMutation) =>
      liveApplicationMutations.apply(actor, operation, tenantId),
    onSuccess: async (saved) => {
      if (!active.current) return;
      setAction(null);
      setFailure(null);
      onSaved(saved);
      toast.success(t("liveApplications.saved"));
      await Promise.all(
        [
          "applications",
          "applicationsPage",
          "application",
          "credentialRegistry",
          "administrativeAudit",
        ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
      );
    },
    onError: (error) => {
      if (active.current) setFailure(applicationMutationFailureKey(error));
    },
  });
  if (!can("apps.manage") || !user || (isPlatform && !tenantId)) return null;
  const begin = (kind: Action) => {
    setAction(kind);
    setFailure(null);
    setConfirmed(false);
    setSenderPage(1);
    setName(application?.name ?? "");
    setEnvironment(application?.environment ?? "production");
    setStatus(application?.status === "active" ? "disabled" : "active");
    setChannels([...(application?.channels ?? [])]);
    setScopes([...(application?.scopes ?? [])]);
    setSenderAccess(application?.senderAccess ?? "allow_list");
    setSenderIds([...(application?.allowListSenderIds ?? [])]);
  };
  const toggle = <T extends string>(values: T[], value: T, checked: boolean) =>
    checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
  const title = (kind: Action | null): MessageKey =>
    kind === "create"
      ? "apps.new"
      : kind === "name"
        ? "liveApplications.rename"
        : kind === "status"
          ? status === "active"
            ? "apps.activate"
            : "apps.deactivate"
          : kind === "channels"
            ? "apps.channels"
            : kind === "scopes"
              ? "common.scopes"
              : "apps.senderAccess";
  const valid =
    ((action !== "create" && action !== "name") ||
      (name.trim().length > 0 && name.trim().length <= 120)) &&
    (action === "create" || action === "name" || confirmed);
  const submit = () => {
    if (!action || !valid) return;
    let operation: LiveApplicationMutation;
    if (action === "create")
      operation = {
        kind: "create",
        input: {
          name,
          environment,
          status,
          channels,
          scopes,
          senderAccess,
          allowListSenderIds: senderAccess === "all_eligible" ? [] : senderIds,
        },
      };
    else {
      if (!application) return;
      const id = application.id;
      if (action === "name") operation = { kind: action, id, name };
      else if (action === "status") operation = { kind: action, id, status };
      else if (action === "channels") operation = { kind: action, id, channels };
      else if (action === "scopes") operation = { kind: action, id, scopes };
      else
        operation = {
          kind: action,
          id,
          senderAccess,
          allowListSenderIds: senderAccess === "all_eligible" ? [] : senderIds,
        };
    }
    mutation.mutate(operation);
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {application ? (
          <>
            {(["name", "channels", "scopes", "sender-access", "status"] as const).map((kind) => (
              <Button
                key={kind}
                variant={
                  kind === "status" && application.status === "active" ? "destructive" : "outline"
                }
                disabled={mutation.isPending}
                onClick={() => begin(kind)}
              >
                {kind === "status"
                  ? t(application.status === "active" ? "apps.deactivate" : "apps.activate")
                  : t(title(kind))}
              </Button>
            ))}
          </>
        ) : (
          <Button onClick={() => begin("create")}>{t("apps.new")}</Button>
        )}
      </div>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setAction(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(title(action))}</DialogTitle>
            <DialogDescription>
              {t(
                action === "create"
                  ? "liveApplications.createHint"
                  : action === "name"
                    ? "liveApplications.renameHint"
                    : "liveApplications.accessWarning",
              )}
            </DialogDescription>
          </DialogHeader>
          {(action === "create" || action === "name") && (
            <div className="space-y-2">
              <Label htmlFor="live-application-name">{t("common.name")}</Label>
              <Input
                id="live-application-name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          )}
          {action === "create" && (
            <div className="space-y-2">
              <Label>{t("common.environment")}</Label>
              <Select
                value={environment}
                onValueChange={(value) => setEnvironment(value as Application["environment"])}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">{t("common.production")}</SelectItem>
                  <SelectItem value="sandbox">{t("common.sandbox")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {action === "create" && (
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as Application["status"])}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                  <SelectItem value="disabled">{t("status.disabled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {(action === "create" || action === "channels") && (
            <div className="space-y-2">
              <Label>{t("apps.channels")}</Label>
              {channelsList.map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={channels.includes(channel)}
                    disabled={mutation.isPending}
                    onCheckedChange={(checked) =>
                      setChannels((values) => toggle(values, channel, checked === true))
                    }
                  />
                  {t(`channel.${channel}`)}
                </label>
              ))}
            </div>
          )}
          {(action === "create" || action === "scopes") && (
            <div className="space-y-2">
              <Label>{t("common.scopes")}</Label>
              {scopesList.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(scope)}
                    disabled={mutation.isPending}
                    onCheckedChange={(checked) =>
                      setScopes((values) => toggle(values, scope, checked === true))
                    }
                  />
                  {scope}
                </label>
              ))}
            </div>
          )}
          {(action === "create" || action === "sender-access") && (
            <div className="space-y-3">
              <Label>{t("apps.senderAccess")}</Label>
              <Select
                value={senderAccess}
                onValueChange={(value) => setSenderAccess(value as typeof senderAccess)}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_eligible">{t("apps.allEligibleSenders")}</SelectItem>
                  <SelectItem value="allow_list">{t("apps.allowListedSenders")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(
                  senderAccess === "all_eligible"
                    ? "liveApplications.allEligibleHint"
                    : "liveApplications.allowListHint",
                )}
              </p>
              {senderAccess === "allow_list" && (
                <>
                  {senderIds.map((id) => (
                    <div key={id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="break-words">
                        <EntityName kind="sender" id={id} tenantId={tenantId} />
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() =>
                          setSenderIds((values) => values.filter((value) => value !== id))
                        }
                      >
                        {t("liveApplications.removeSender")}
                      </Button>
                    </div>
                  ))}
                  {senderQuery.isPending ? (
                    <TableSkeleton rows={3} />
                  ) : senderQuery.isError ? (
                    <ErrorState
                      error={senderQuery.error}
                      onRetry={() => void senderQuery.refetch()}
                    />
                  ) : senderQuery.data?.items.length === 0 ? (
                    <EmptyState title={t("liveApplications.noSenders")} />
                  ) : (
                    senderQuery.data?.items.map((sender) => (
                      <label key={sender.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={senderIds.includes(sender.id)}
                          disabled={mutation.isPending || !channels.includes(sender.channel)}
                          onCheckedChange={(checked) =>
                            setSenderIds((values) => toggle(values, sender.id, checked === true))
                          }
                        />
                        <span>
                          {sender.displayName ??
                            (sender.channel === "sms"
                              ? sender.sms.senderId
                              : sender.channel === "email"
                                ? sender.email.emailAddress
                                : sender.whatsapp.phoneNumber)}{" "}
                          <span className="text-xs text-muted-foreground">
                            {t(`channel.${sender.channel}`)}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                  {senderQuery.data && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={senderPage <= 1 || mutation.isPending}
                        onClick={() => setSenderPage((value) => value - 1)}
                      >
                        {t("common.previous")}
                      </Button>
                      <span>
                        {senderPage} / {Math.max(1, Math.ceil(senderQuery.data.total / 20))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={senderPage * 20 >= senderQuery.data.total || mutation.isPending}
                        onClick={() => setSenderPage((value) => value + 1)}
                      >
                        {t("common.next")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {action !== "create" && action !== "name" && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirmed}
                disabled={mutation.isPending}
                onCheckedChange={(value) => setConfirmed(value === true)}
              />
              {t("liveApplications.confirmAccess")}
            </label>
          )}
          {failure && (
            <MessageAlert className="text-sm text-destructive">{t(failure)}</MessageAlert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!valid || mutation.isPending} onClick={submit}>
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
