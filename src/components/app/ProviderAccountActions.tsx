import { MessageAlert } from "@/components/app/MessageAlert";
import { useEffect, useRef, useState } from "react";
import { useEntityName } from "@/components/app/EntityName";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { providerAccountMutations } from "@/lib/api/queries";
import { providerMonitorKey } from "@/lib/api/provider-monitoring";
import type { ProviderAccountMetadata } from "@/lib/api/provider-monitoring";
import { providerAccountFailureKey } from "@/lib/api/provider-account-mutations";
import type { ProviderAccountMutation } from "@/lib/api/provider-account-mutations";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function ProviderAccountActions({
  actor,
  account,
  onCreated,
}: {
  actor: SenderIdentityActor;
  account?: ProviderAccountMetadata | undefined;
  onCreated?: ((id: string) => void) | undefined;
}) {
  const { can } = useSession();
  const { t } = useI18n();
  const taqnyatChannel =
    account?.transport === "TAQNYAT_EMAIL" || account?.transport === "TAQNYAT_WHATSAPP";
  const qc = useQueryClient();
  const [kind, setKind] = useState<ProviderAccountMutation["kind"] | null>(null);
  const [channel, setChannel] = useState<"SMS" | "EMAIL" | "WHATSAPP">("SMS");
  const [taqnyat, setTaqnyat] = useState(true);
  const useTaqnyat = (account ? taqnyatChannel : taqnyat) && channel !== "SMS";
  const [code, setCode] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [username, setUsername] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [appSecretInput, setAppSecretInput] = useState("");
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [version, setVersion] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedName = useEntityName("provider", savedId);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function clearSecrets() {
    setTokenInput("");
    setUsername("");
    setSecretInput("");
    setAppSecretInput("");
    setVerifyTokenInput("");
  }
  const mutation = useMutation({
    mutationKey: [...providerMonitorKey(actor), "configure", account?.id],
    retry: false,
    gcTime: 0,
    // Only the operation name enters mutation variables. Secret input stays in
    // component memory and the immediate API request, never TanStack caches.
    mutationFn: async (action: ProviderAccountMutation["kind"]) => {
      let request: ProviderAccountMutation;
      if (action === "callbackConfigure") {
        if (!account) throw new Error("Account required");
        request = {
          kind: action,
          id: account.id,
          appSecret: appSecretInput,
          verifyToken: verifyTokenInput,
        };
      } else if (action === "callbackAppSecret") {
        if (!account) throw new Error("Account required");
        request = { kind: action, id: account.id, appSecret: appSecretInput };
      } else if (action === "callbackVerifyToken") {
        if (!account) throw new Error("Account required");
        request = { kind: action, id: account.id, verifyToken: verifyTokenInput };
      } else if (action === "reencrypt") {
        if (!account) throw new Error("Account required");
        request = { kind: action, id: account.id, keyVersion: Number(version) };
      } else if (useTaqnyat) {
        const credentials: {
          channel: "EMAIL" | "WHATSAPP";
          transport: "TAQNYAT_EMAIL" | "TAQNYAT_WHATSAPP";
          token: string;
        } = {
          channel,
          transport: channel === "EMAIL" ? "TAQNYAT_EMAIL" : "TAQNYAT_WHATSAPP",
          token: tokenInput,
        };
        request =
          action === "create"
            ? { kind: action, code, ...credentials }
            : { kind: action, id: account!.id, ...credentials };
      } else {
        const credentials =
          channel === "EMAIL"
            ? { channel, username, secret: secretInput }
            : { channel, token: tokenInput };
        request =
          action === "create"
            ? { kind: action, code, ...credentials }
            : { kind: action, id: account!.id, ...credentials };
      }
      try {
        return await providerAccountMutations.apply(actor, request);
      } finally {
        if (active.current) clearSecrets();
      }
    },
    onSuccess: async (result, action) => {
      if (!active.current) return;
      setKind(null);
      setSavedId(result.id);
      if (action === "create") onCreated?.(result.id);
      await qc.invalidateQueries({ queryKey: providerMonitorKey(actor) });
    },
  });
  if (!can("platform.providers.manage")) return null;
  function open(action: ProviderAccountMutation["kind"]) {
    mutation.reset();
    setSavedId(null);
    setKind(action);
    setChannel(account?.channel ?? "SMS");
    setTaqnyat(account ? taqnyatChannel : true);
    setCode("");
    setVersion("");
    clearSecrets();
  }
  const accountValid =
    kind === "reencrypt"
      ? Number.isInteger(Number(version)) && Number(version) >= 1 && Number(version) <= 9999
      : (kind !== "create" || /^[a-z0-9][a-z0-9-]{1,62}$/.test(code)) &&
        (useTaqnyat
          ? /^[\x21-\x7e]{1,4096}$/.test(tokenInput)
          : channel === "EMAIL"
            ? /^[A-Za-z0-9][A-Za-z0-9._@-]{0,199}$/.test(username) &&
              /^[^\s]{1,512}$/.test(secretInput)
            : channel === "WHATSAPP"
              ? /^[^\s]{16,4096}$/.test(tokenInput) && !tokenInput.startsWith("{")
              : tokenInput.trim().length > 0 &&
                tokenInput.length <= 4096 &&
                !/[\r\n]/.test(tokenInput));
  const callback =
    kind === "callbackConfigure" || kind === "callbackAppSecret" || kind === "callbackVerifyToken";
  const valid = callback
    ? (kind === "callbackVerifyToken" || /^[^\s]{16,256}$/.test(appSecretInput)) &&
      (kind === "callbackAppSecret" || /^[A-Za-z0-9._~-]{16,128}$/.test(verifyTokenInput)) &&
      (kind !== "callbackConfigure" || appSecretInput !== verifyTokenInput)
    : accountValid;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {account ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={account.status !== "ACTIVE" || mutation.isPending || !account.transport}
              onClick={() => open("replace")}
            >
              {t("providerAccounts.replace")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={account.status !== "ACTIVE" || mutation.isPending}
              onClick={() => open("reencrypt")}
            >
              {t("providerAccounts.reencrypt")}
            </Button>
            {account.transport === "META_GRAPH" &&
              (["callbackConfigure", "callbackAppSecret", "callbackVerifyToken"] as const).map(
                (action) => (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    disabled={account.status !== "ACTIVE" || mutation.isPending}
                    onClick={() => open(action)}
                  >
                    {t(`providerAccounts.${action}`)}
                  </Button>
                ),
              )}
          </>
        ) : (
          <Button disabled={mutation.isPending} onClick={() => open("create")}>
            {t("providerAccounts.create")}
          </Button>
        )}
      </div>
      {savedId && <p role="status">{t("providerAccounts.saved", { id: savedName })}</p>}
      {taqnyatChannel && (
        <p className="text-sm text-muted-foreground">{t("providerAccounts.taqnyatSetup")}</p>
      )}
      <Dialog
        open={kind !== null}
        onOpenChange={(value) => {
          if (!value && !mutation.isPending) {
            setKind(null);
            clearSecrets();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{kind && t(`providerAccounts.${kind}`)}</DialogTitle>
            <DialogDescription>
              {t(
                callback
                  ? "providerAccounts.callbackNote"
                  : kind === "reencrypt"
                    ? "providerAccounts.reencryptNote"
                    : "providerAccounts.configureNote",
              )}
            </DialogDescription>
          </DialogHeader>
          {account && (
            <p className="font-mono text-xs">
              {account.code}
            </p>
          )}
          <fieldset disabled={mutation.isPending} className="space-y-3">
            {kind === "create" && (
              <>
                <Label htmlFor="provider-account-channel">{t("common.channel")}</Label>
                <Select
                  value={channel}
                  onValueChange={(value) => {
                    setChannel(value as typeof channel);
                    setTaqnyat(value === "WHATSAPP");
                    clearSecrets();
                  }}
                >
                  <SelectTrigger id="provider-account-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["SMS", "EMAIL", "WHATSAPP"] as const).map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(`channel.${item.toLowerCase() as "sms" | "email" | "whatsapp"}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {channel !== "SMS" && (
                  <>
                    <Label htmlFor="provider-account-transport">
                      {t("providerAccounts.transport")}
                    </Label>
                    <Select
                      value={taqnyat ? "taqnyat" : "legacy"}
                      onValueChange={(value) => {
                        setTaqnyat(value === "taqnyat");
                        clearSecrets();
                      }}
                    >
                      <SelectTrigger id="provider-account-transport">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="taqnyat">
                          {t(
                            channel === "EMAIL"
                              ? "providerTransport.TAQNYAT_EMAIL"
                              : "providerTransport.TAQNYAT_WHATSAPP",
                          )}
                        </SelectItem>
                        <SelectItem value="legacy">
                          {t(
                            channel === "EMAIL"
                              ? "providerTransport.TURBO_SMTP"
                              : "providerTransport.META_GRAPH",
                          )}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
                <Label htmlFor="provider-account-code">{t("liveProviders.code")}</Label>
                <Input
                  id="provider-account-code"
                  dir="ltr"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={63}
                />
              </>
            )}
            {callback ? (
              <>
                {kind !== "callbackVerifyToken" && (
                  <>
                    <Label htmlFor="provider-callback-app-secret">
                      {t("providerAccounts.appSecret")}
                    </Label>
                    <Input
                      id="provider-callback-app-secret"
                      type="password"
                      dir="ltr"
                      value={appSecretInput}
                      onChange={(event) => setAppSecretInput(event.target.value)}
                      maxLength={256}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </>
                )}
                {kind !== "callbackAppSecret" && (
                  <>
                    <Label htmlFor="provider-callback-verify-token">
                      {t("providerAccounts.verifyToken")}
                    </Label>
                    <Input
                      id="provider-callback-verify-token"
                      type="password"
                      dir="ltr"
                      value={verifyTokenInput}
                      onChange={(event) => setVerifyTokenInput(event.target.value)}
                      maxLength={128}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </>
                )}
              </>
            ) : kind === "reencrypt" ? (
              <>
                <Label htmlFor="provider-account-version">{t("providerAccounts.version")}</Label>
                <Input
                  id="provider-account-version"
                  type="number"
                  min={1}
                  max={9999}
                  step={1}
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                />
              </>
            ) : channel === "EMAIL" && !useTaqnyat ? (
              <>
                <Label htmlFor="provider-account-username">{t("providerAccounts.username")}</Label>
                <Input
                  id="provider-account-username"
                  dir="ltr"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={200}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Label htmlFor="provider-account-secret">{t("providerAccounts.smtpSecret")}</Label>
                <Input
                  id="provider-account-secret"
                  type="password"
                  dir="ltr"
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                  maxLength={512}
                  autoComplete="off"
                  spellCheck={false}
                />
              </>
            ) : (
              <>
                <Label htmlFor="provider-account-token">
                  {t(
                    channel === "WHATSAPP"
                      ? "providerAccounts.metaToken"
                      : "providerAccounts.smsToken",
                  )}
                </Label>
                <Input
                  id="provider-account-token"
                  type="password"
                  dir="ltr"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  maxLength={4096}
                  autoComplete="off"
                  spellCheck={false}
                />
              </>
            )}
          </fieldset>
          {mutation.isError && <MessageAlert>{t(providerAccountFailureKey(mutation.error))}</MessageAlert>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setKind(null);
                clearSecrets();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={mutation.isPending || !valid}
              onClick={() => {
                if (kind) mutation.mutate(kind);
              }}
            >
              {t("providerAccounts.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
