import type { ProviderAdapterConfigInput, ProviderAdapterConfigMap, ProviderAdapterConfigSummary, ProviderAdapterId, ProviderAdapterPublicConfigMap } from "./types";
import type { MessageKey } from "../i18n/en";
import type { Channel } from "./types";

type AdapterField<Id extends ProviderAdapterId> = {
  key: keyof ProviderAdapterConfigMap[Id] & string;
  label: MessageKey;
  kind: "text" | "url" | "password" | "number" | "toggle" | "select";
  required?: boolean;
  secret?: boolean;
  defaultValue?: string | boolean;
  options?: readonly { value: string; label: MessageKey }[];
};

export type ProviderAdapterDefinition = {
  [Id in ProviderAdapterId]: {
    id: Id;
    channel: Channel;
    name: string;
    fields: readonly AdapterField<Id>[];
  }
}[ProviderAdapterId];

export const PROVIDER_ADAPTER_CATALOG: readonly ProviderAdapterDefinition[] = [
  { id: "taqnyat", channel: "sms", name: "Taqnyat", fields: [
    { key: "apiBaseUrl", label: "prov.field.apiBaseUrl", kind: "url", required: true },
    { key: "apiKey", label: "prov.field.apiKey", kind: "password", secret: true, required: true },
  ] },
  { id: "infobip", channel: "sms", name: "Infobip", fields: [
    { key: "apiBaseUrl", label: "prov.field.apiBaseUrl", kind: "url", required: true },
    { key: "apiKey", label: "prov.field.apiKey", kind: "password", secret: true, required: true },
  ] },
  { id: "twilio", channel: "sms", name: "Twilio", fields: [
    { key: "accountSid", label: "prov.field.accountSid", kind: "text", required: true },
    { key: "authToken", label: "prov.field.authToken", kind: "password", secret: true, required: true },
    { key: "fromNumber", label: "prov.field.fromNumber", kind: "text", required: true },
  ] },
  { id: "smsCustom", channel: "sms", name: "Custom", fields: [
    { key: "apiBaseUrl", label: "prov.field.apiBaseUrl", kind: "url", required: true },
    { key: "credential", label: "prov.field.credential", kind: "password", secret: true, required: true },
    { key: "apiSecret", label: "prov.field.apiSecret", kind: "password", secret: true },
  ] },
  { id: "metaCloudApi", channel: "whatsapp", name: "Meta Cloud API", fields: [
    { key: "wabaId", label: "prov.field.wabaId", kind: "text", required: true },
    { key: "phoneNumberId", label: "prov.field.phoneNumberId", kind: "text", required: true },
    { key: "accessToken", label: "prov.field.accessToken", kind: "password", secret: true, required: true },
    { key: "webhookUrl", label: "prov.field.webhookUrl", kind: "url" },
    { key: "webhookStatus", label: "prov.field.webhookStatus", kind: "select", defaultValue: "pending", options: [
      { value: "configured", label: "prov.webhookConfigured" }, { value: "pending", label: "prov.webhookPending" },
    ] },
  ] },
  { id: "customBsp", channel: "whatsapp", name: "Custom BSP", fields: [
    { key: "apiBaseUrl", label: "prov.field.apiBaseUrl", kind: "url", required: true },
    { key: "apiKey", label: "prov.field.apiKey", kind: "password", secret: true, required: true },
    { key: "apiSecret", label: "prov.field.apiSecret", kind: "password", secret: true },
  ] },
  { id: "awsSes", channel: "email", name: "AWS SES", fields: [
    { key: "awsRegion", label: "prov.field.awsRegion", kind: "text", required: true },
    { key: "accessKeyId", label: "prov.field.accessKeyId", kind: "password", secret: true, required: true },
    { key: "secretAccessKey", label: "prov.field.secretAccessKey", kind: "password", secret: true, required: true },
  ] },
  { id: "smtp", channel: "email", name: "SMTP", fields: [
    { key: "host", label: "prov.field.host", kind: "text", required: true },
    { key: "port", label: "prov.field.port", kind: "number", required: true, defaultValue: "587" },
    { key: "username", label: "prov.field.username", kind: "text", required: true },
    { key: "password", label: "prov.field.password", kind: "password", secret: true, required: true },
    { key: "secure", label: "prov.field.secure", kind: "toggle", defaultValue: true },
  ] },
  { id: "emailCustom", channel: "email", name: "Custom", fields: [
    { key: "apiBaseUrl", label: "prov.field.apiBaseUrl", kind: "url", required: true },
    { key: "apiKey", label: "prov.field.apiKey", kind: "password", secret: true, required: true },
    { key: "apiSecret", label: "prov.field.apiSecret", kind: "password", secret: true },
  ] },
];

export type ProviderAdapterValues = Record<string, string | boolean>;

export function getProviderAdapters(channel: Channel) {
  return PROVIDER_ADAPTER_CATALOG.filter((adapter) => adapter.channel === channel);
}

export function getProviderAdapter(adapterId: ProviderAdapterId) {
  return PROVIDER_ADAPTER_CATALOG.find((adapter) => adapter.id === adapterId);
}

export function createBlankAdapterValues(adapterId: ProviderAdapterId): ProviderAdapterValues {
  const adapter = getProviderAdapter(adapterId);
  if (!adapter) return {};
  return Object.fromEntries(adapter.fields.map((field) => [field.key, field.defaultValue ?? (field.kind === "toggle" ? false : "")]));
}

export function createAdapterConfigInput(adapterId: ProviderAdapterId, values: ProviderAdapterValues): ProviderAdapterConfigInput {
  return { adapterId, values } as ProviderAdapterConfigInput;
}

export function createPublicAdapterConfig(config: ProviderAdapterConfigInput): ProviderAdapterConfigSummary {
  const adapter = getProviderAdapter(config.adapterId);
  const secretKeys = new Set(adapter?.fields.filter((field) => field.secret).map((field) => field.key) ?? []);
  const values = Object.fromEntries(Object.entries(config.values).filter(([key]) => !secretKeys.has(key as never)));
  return { adapterId: config.adapterId, values } as ProviderAdapterConfigSummary;
}

export function adapterHasRequiredValues(config: ProviderAdapterConfigInput, allowBlankSecrets = false) {
  const adapter = getProviderAdapter(config.adapterId);
  if (!adapter) return false;
  return adapter.fields.every((field) => {
    if (!field.required || (allowBlankSecrets && field.secret)) return true;
    const value = config.values[field.key as keyof typeof config.values];
    return typeof value === "boolean" || String(value ?? "").trim().length > 0;
  });
}

export function mergeAdapterSecrets(existing: ProviderAdapterConfigInput | undefined, incoming: ProviderAdapterConfigInput): ProviderAdapterConfigInput {
  if (!existing || existing.adapterId !== incoming.adapterId) return incoming;
  const adapter = getProviderAdapter(incoming.adapterId);
  if (!adapter) return incoming;
  const values: Record<string, string | boolean> = { ...incoming.values };
  for (const field of adapter.fields) {
    if (field.secret && !String(values[field.key] ?? "").trim()) {
      values[field.key] = existing.values[field.key as keyof typeof existing.values] as string;
    }
  }
  return { adapterId: incoming.adapterId, values } as ProviderAdapterConfigInput;
}

export function adapterHasConfiguredSecret(config: ProviderAdapterConfigInput) {
  const adapter = getProviderAdapter(config.adapterId);
  return !!adapter?.fields.some((field) => field.secret && String(config.values[field.key as keyof typeof config.values] ?? "").trim());
}