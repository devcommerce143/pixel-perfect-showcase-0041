import { ApiError } from "./http/errors.ts";
export type ProviderAccountMutation =
  | {
      kind: "create";
      channel: "EMAIL" | "WHATSAPP";
      transport: "TAQNYAT_EMAIL" | "TAQNYAT_WHATSAPP";
      code: string;
      token: string;
    }
  | {
      kind: "replace";
      channel: "EMAIL" | "WHATSAPP";
      transport: "TAQNYAT_EMAIL" | "TAQNYAT_WHATSAPP";
      id: string;
      token: string;
    }
  | { kind: "create"; channel: "SMS" | "WHATSAPP"; code: string; token: string }
  | { kind: "create"; channel: "EMAIL"; code: string; username: string; secret: string }
  | { kind: "replace"; channel: "SMS" | "WHATSAPP"; id: string; token: string }
  | { kind: "replace"; channel: "EMAIL"; id: string; username: string; secret: string }
  | { kind: "reencrypt"; id: string; keyVersion: number }
  | { kind: "callbackConfigure"; id: string; appSecret: string; verifyToken: string }
  | { kind: "callbackAppSecret"; id: string; appSecret: string }
  | { kind: "callbackVerifyToken"; id: string; verifyToken: string };
export interface ProviderAccountMutationResult {
  id: string;
  keyVersion?: number;
}
export function providerAccountFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "providerAccounts.forbidden";
    if (error.statusCode === 400 || error.statusCode === 422) return "providerAccounts.validation";
    if (error.statusCode === 409) return "providerAccounts.conflict";
  }
  return "providerAccounts.error";
}
