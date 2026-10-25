import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";

export function MessageAlert({
  children,
  title,
  variant = "error",
  className,
}: {
  children: ReactNode;
  title?: string;
  variant?: "info" | "warning" | "error" | "success";
  className?: string;
}) {
  const { t } = useI18n();
  const Icon = { info: Info, warning: TriangleAlert, error: AlertCircle, success: CheckCircle2 }[
    variant
  ];
  const colors = {
    info: "border-info/30 bg-info-soft text-info",
    warning: "border-warning/30 bg-warning-soft text-warning",
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
  };
  return (
    <Alert
      role={variant === "error" ? "alert" : "status"}
      className={cn(colors[variant], "text-start", className)}
    >
      <Icon className="size-4" aria-hidden="true" />
      <AlertTitle>{title ?? t(`notice.title.${variant}`)}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
