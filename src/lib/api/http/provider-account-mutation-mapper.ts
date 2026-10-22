import type { SenderIdentityActor } from "../types.ts";
import type {
  ProviderAccountMutation,
  ProviderAccountMutationResult,
} from "../provider-account-mutations.ts";
import { providerMetadataPath } from "./provider-monitoring-mapper.ts";
function fail(): never {
  throw new Error("Invalid provider account mutation contract");
}
function code(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value) ? value : fail();
}
function token(value: string, channel: "SMS" | "WHATSAPP") {
  if (channel === "WHATSAPP")
    return /^[^\s]{16,4096}$/.test(value) && !value.startsWith("{") ? value : fail();
  return value.length > 0 && value.length <= 4096 && !/[\r\n]/.test(value) ? value : fail();
}
function email(value: { username: string; secret: string }) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._@-]{0,199}$/.test(value.username) ||
    !/^[^\s]{1,512}$/.test(value.secret)
  )
    fail();
  return { username: value.username, secret: value.secret };
}
export function providerAccountMutationRequest(
  actor: SenderIdentityActor,
  operation: ProviderAccountMutation,
) {
  if (actor.role !== "super_admin" || !actor.userId) fail();
  if (
    operation.kind === "callbackConfigure" ||
    operation.kind === "callbackAppSecret" ||
    operation.kind === "callbackVerifyToken"
  ) {
    const path = providerMetadataPath(actor, operation.id);
    if ("appSecret" in operation && !/^[^\s]{16,256}$/.test(operation.appSecret)) fail();
    if ("verifyToken" in operation && !/^[A-Za-z0-9._~-]{16,128}$/.test(operation.verifyToken))
      fail();
    if (operation.kind === "callbackConfigure") {
      if (operation.appSecret === operation.verifyToken) fail();
      return {
        path: `${path}/meta-callback-secrets`,
        body: { appSecret: operation.appSecret, verifyToken: operation.verifyToken },
      };
    }
    return operation.kind === "callbackAppSecret"
      ? { path: `${path}/meta-callback-app-secret`, body: { appSecret: operation.appSecret } }
      : {
          path: `${path}/meta-callback-verify-token`,
          body: { verifyToken: operation.verifyToken },
        };
  }
  if (operation.kind === "reencrypt") {
    if (
      !Number.isInteger(operation.keyVersion) ||
      operation.keyVersion < 1 ||
      operation.keyVersion > 9999
    )
      fail();
    return {
      path: `${providerMetadataPath(actor, operation.id)}/reencrypt`,
      body: { keyVersion: operation.keyVersion },
    };
  }
  if (!["SMS", "EMAIL", "WHATSAPP"].includes(operation.channel)) fail();
  if ("transport" in operation) {
    if (operation.kind !== "create" && operation.kind !== "replace") fail();
    if (
      operation.transport !==
      (operation.channel === "EMAIL"
        ? "TAQNYAT_EMAIL"
        : operation.channel === "WHATSAPP"
          ? "TAQNYAT_WHATSAPP"
          : null)
    )
      fail();
    if (!/^[\x21-\x7e]{1,4096}$/.test(operation.token)) fail();
    return operation.kind === "create"
      ? {
          path: `/provider-accounts/taqnyat/${operation.channel.toLowerCase()}`,
          body: { code: code(operation.code), token: operation.token },
        }
      : {
          path: `${providerMetadataPath(actor, operation.id)}/taqnyat-token`,
          body: { token: operation.token },
        };
  }
  const credentials =
    operation.channel === "EMAIL"
      ? email(operation)
      : { token: token(operation.token, operation.channel) };
  if (operation.kind === "create")
    return {
      path: `/provider-accounts${operation.channel === "EMAIL" ? "/email" : operation.channel === "WHATSAPP" ? "/whatsapp" : ""}`,
      body: { code: code(operation.code), ...credentials },
    };
  if (operation.kind !== "replace") return fail();
  return {
    path: `${providerMetadataPath(actor, operation.id)}/${operation.channel === "EMAIL" ? "email-credentials" : operation.channel === "WHATSAPP" ? "whatsapp-token" : "token"}`,
    body: credentials,
  };
}
export function mapProviderAccountMutation(
  value: unknown,
  operation: ProviderAccountMutation,
): ProviderAccountMutationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const row = value as Record<string, unknown>;
  const id = row["id"];
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
    (operation.kind !== "create" && id !== operation.id)
  )
    fail();
  if (operation.kind !== "create" && operation.kind !== "reencrypt") return { id };
  const keyVersion = row["keyVersion"];
  if (
    !Number.isSafeInteger(keyVersion) ||
    (keyVersion as number) < 1 ||
    (operation.kind === "reencrypt" && keyVersion !== operation.keyVersion)
  )
    fail();
  return { id, keyVersion: keyVersion as number };
}
