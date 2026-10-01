import { cn } from "@/lib/utils";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { STATUS_DEFS, TONE_CLASSES } from "./status";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const def = STATUS_DEFS[status] ?? STATUS_DEFS.draft;
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[def.tone],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(`status.${status}` as MessageKey)}
    </span>
  );
}
