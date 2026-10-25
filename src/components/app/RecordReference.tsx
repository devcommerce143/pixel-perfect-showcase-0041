import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n";

/** Unnamed operational records have a description, with their reference available to copy. */
export function RecordReference({
  value,
  label,
}: {
  value: string | null | undefined;
  label?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!value) return <>{t("entity.unavailable")}</>;
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label ?? t("entity.record")}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t("common.copy")}
        onClick={async (event) => {
          event.stopPropagation();
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-danger">
          {t("entity.copyFailed")}
        </span>
      )}
    </span>
  );
}
