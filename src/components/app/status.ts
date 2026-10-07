import { AlertTriangle, Ban, CheckCheck, CheckCircle2, Clock, Loader2, type LucideIcon, MinusCircle, Send, XCircle } from "lucide-react";

export type Tone = "success" | "info" | "warning" | "danger" | "neutral";

/** Single source of truth for status → tone + icon. */
export const STATUS_DEFS: Record<string, { tone: Tone; icon: LucideIcon }> = {
  delivered: { tone: "success", icon: CheckCircle2 },
  active: { tone: "success", icon: CheckCircle2 },
  healthy: { tone: "success", icon: CheckCircle2 },
  approved: { tone: "success", icon: CheckCircle2 },
  verified: { tone: "success", icon: CheckCircle2 },
  success: { tone: "success", icon: CheckCircle2 },
  accepted: { tone: "info", icon: CheckCircle2 },
  sent: { tone: "info", icon: Send },
  processing: { tone: "info", icon: Loader2 },
  in_progress: { tone: "info", icon: Loader2 },
  read: { tone: "info", icon: CheckCheck },
  pending: { tone: "warning", icon: Clock },
  pending_approval: { tone: "warning", icon: Clock },
  pending_verification: { tone: "warning", icon: Clock },
  submitted: { tone: "info", icon: Send },
  queued: { tone: "neutral", icon: Clock },
  degraded: { tone: "warning", icon: AlertTriangle },
  timeout: { tone: "warning", icon: AlertTriangle },
  trial: { tone: "warning", icon: Clock },
  completed: { tone: "success", icon: CheckCircle2 },
  scheduled: { tone: "neutral", icon: Clock },
  partial: { tone: "warning", icon: AlertTriangle },
  invited: { tone: "warning", icon: Clock },
  pending_activation: { tone: "warning", icon: Clock },
  failed: { tone: "danger", icon: XCircle },
  rejected: { tone: "danger", icon: XCircle },
  cancelled: { tone: "neutral", icon: MinusCircle },
  unavailable: { tone: "danger", icon: XCircle },
  revoked: { tone: "danger", icon: Ban },
  failure: { tone: "danger", icon: XCircle },
  suspended: { tone: "danger", icon: Ban },
  draft: { tone: "neutral", icon: MinusCircle },
  disabled: { tone: "neutral", icon: MinusCircle },
    inactive: { tone: "neutral", icon: MinusCircle },
    archived: { tone: "neutral", icon: MinusCircle },
  expired: { tone: "neutral", icon: MinusCircle },
};

export const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
};
