import { useEffect, useRef, useState } from "react";
import { EmailEvidencePanel } from "./EmailEvidencePanel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { liveSenderMutations } from "@/lib/api/queries";
import {
  availableSenderActions,
  senderMutationFailureKey,
  senderMutationKey,
} from "@/lib/api/sender-mutations";
import type { LiveSenderMutation, SenderRegistration } from "@/lib/api/sender-mutations";
import type { Channel, SenderIdentityActor, SenderIdentityRead } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function LiveSenderActions({
  actor,
  tenantId,
  identity,
}: {
  actor: SenderIdentityActor;
  tenantId?: string | undefined;
  identity?: SenderIdentityRead | undefined;
}) {
  const { can } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [operation, setOperation] = useState<LiveSenderMutation["kind"] | null>(null);
  const [channel, setChannel] = useState<Channel>("sms");
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [value, setValue] = useState("");
  const [country, setCountry] = useState("");
  const [business, setBusiness] = useState("");
  const [waba, setWaba] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationKey: senderMutationKey(actor, tenantId),
    retry: false,
    mutationFn: (next: LiveSenderMutation) => liveSenderMutations.apply(actor, next, tenantId),
    onSuccess: async () => {
      if (!active.current) return;
      setOperation(null);
      setSaved(true);
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ["senderIdentityReadPage", actor.userId, actor.role, actor.tenantId],
        }),
        qc.invalidateQueries({
          queryKey: ["senderIdentityRead", actor.userId, actor.role, actor.tenantId],
        }),
      ]);
    },
  });
  const allowed = can("senderIdentities.request") || can("platform.senderIdentities.manage");
  if (!allowed || (actor.role === "super_admin" && !tenantId)) return null;
  function open(kind: LiveSenderMutation["kind"]) {
    mutation.reset();
    setSaved(false);
    setOperation(kind);
    setReason("");
    if (kind === "create") {
      setChannel("sms");
      setName("");
      setValue("");
      setCountry("");
      setBusiness("");
      setWaba("");
      setPhoneId("");
      setReference("");
    }
  }
  function submit() {
    if (!operation) return;
    if (operation !== "create") {
      if (identity)
        mutation.mutate({
          kind: operation,
          id: identity.id,
          ...(operation === "reject" || operation === "suspend" ? { reason } : {}),
        });
      return;
    }
    const common = {
      displayName: name,
      ...(reference.trim() ? { providerReference: reference } : {}),
    };
    const input: SenderRegistration =
      channel === "sms"
        ? { ...common, channel, senderId: value, countryCode: country }
        : channel === "email"
          ? { ...common, channel, emailAddress: value }
          : {
              ...common,
              channel,
              businessDisplayName: business,
              phoneNumber: value,
              countryCode: country,
              wabaId: waba,
              phoneNumberId: phoneId,
            };
    mutation.mutate({ kind: "create", input });
  }
  const needsReason = operation === "reject" || operation === "suspend";
  const valid =
    operation === "create"
      ? !!name.trim() &&
        (channel === "sms"
          ? /^[A-Za-z0-9]{3,11}$/.test(value.trim()) && /^[A-Za-z]{2}$/.test(country.trim())
          : channel === "email"
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
            : /^\+[1-9]\d{7,14}$/.test(value.trim()) &&
              /^[A-Za-z]{2}$/.test(country.trim()) &&
              !!business.trim() &&
              !!waba.trim() &&
              !!phoneId.trim())
      : !needsReason || !!reason.trim();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {identity ? (
          availableSenderActions(identity, actor.role === "super_admin").map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => open(kind)}
            >
              {t(`liveSenders.action.${kind}`)}
            </Button>
          ))
        ) : (
          <Button disabled={mutation.isPending} onClick={() => open("create")}>
            {t("liveSenders.action.create")}
          </Button>
        )}
      </div>
      {saved && <p role="status">{t("liveSenders.saved")}</p>}
      {identity?.channel === "email" &&
        actor.role === "super_admin" &&
        tenantId &&
        can("platform.senderIdentities.manage") && (
          <EmailEvidencePanel
            key={`${actor.userId}:${tenantId}:${identity.id}`}
            actor={actor}
            tenantId={tenantId}
            senderId={identity.id}
          />
        )}
      <Dialog
        open={operation !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !mutation.isPending) setOperation(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{operation && t(`liveSenders.action.${operation}`)}</DialogTitle>
            <DialogDescription>{t("liveSenders.internalOnly")}</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs">
            {actor.role === "super_admin" ? tenantId : actor.tenantId}
            {identity ? ` / ${identity.id}` : ""}
          </p>
          {operation === "create" && (
            <div className="space-y-3">
              <Label htmlFor="sender-channel">{t("common.channel")}</Label>
              <Select
                value={channel}
                onValueChange={(next) => {
                  setChannel(next as Channel);
                  setValue("");
                }}
              >
                <SelectTrigger id="sender-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["sms", "email", "whatsapp"] as const).map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`channel.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label htmlFor="sender-name">{t("liveSenders.name")}</Label>
              <Input
                id="sender-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
              />
              <Label htmlFor="sender-value">
                {t(
                  channel === "sms"
                    ? "liveSenders.sms"
                    : channel === "email"
                      ? "liveSenders.email"
                      : "liveSenders.phone",
                )}
              </Label>
              <Input
                id="sender-value"
                dir="ltr"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={channel === "sms" ? 11 : channel === "email" ? 320 : 20}
              />
              {channel !== "email" && (
                <>
                  <Label htmlFor="sender-country">{t("liveSenders.country")}</Label>
                  <Input
                    id="sender-country"
                    dir="ltr"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    maxLength={2}
                  />
                </>
              )}
              {channel === "whatsapp" && (
                <>
                  <Label htmlFor="sender-business">{t("liveSenders.business")}</Label>
                  <Input
                    id="sender-business"
                    value={business}
                    onChange={(event) => setBusiness(event.target.value)}
                    maxLength={200}
                  />
                  <Label htmlFor="sender-waba">{t("liveSenders.waba")}</Label>
                  <Input
                    id="sender-waba"
                    dir="ltr"
                    value={waba}
                    onChange={(event) => setWaba(event.target.value)}
                    maxLength={64}
                  />
                  <Label htmlFor="sender-phone-id">{t("liveSenders.phoneId")}</Label>
                  <Input
                    id="sender-phone-id"
                    dir="ltr"
                    value={phoneId}
                    onChange={(event) => setPhoneId(event.target.value)}
                    maxLength={64}
                  />
                </>
              )}
              <Label htmlFor="sender-reference">{t("liveSenders.reference")}</Label>
              <Input
                id="sender-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={255}
              />
              <p className="text-subtle">{t("liveSenders.immutable")}</p>
            </div>
          )}
          {needsReason && (
            <>
              <Label htmlFor="sender-reason">{t("liveSenders.reason")}</Label>
              <Textarea
                id="sender-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
              />
            </>
          )}
          {mutation.isError && <p role="alert">{t(senderMutationFailureKey(mutation.error))}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOperation(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={!valid || mutation.isPending} onClick={submit}>
              {t("liveSenders.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
