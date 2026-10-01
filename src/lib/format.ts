import type { Locale } from "@/lib/i18n/i18n";

const TZ = "Asia/Riyadh";
const tag = (l: Locale) => (l === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB");

export function formatDateTime(isoStr: string, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(isoStr));
}
export function formatDate(isoStr: string, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeZone: TZ }).format(new Date(isoStr));
}
export function formatTime(isoStr: string, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ }).format(new Date(isoStr));
}
export function formatShortDay(isoDate: string, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(isoDate));
}
export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", opts).format(n);
}
export function formatCompact(n: number, locale: Locale) {
  return formatNumber(n, locale, { notation: "compact", maximumFractionDigits: 1 });
}
export function formatPercent(n: number, locale: Locale, digits = 1) {
  return `${formatNumber(n, locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}
