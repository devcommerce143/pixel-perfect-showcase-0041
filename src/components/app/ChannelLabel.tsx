import { Mail, MessageCircle, MessageSquareText } from "lucide-react";
import type { Channel } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";

export const CHANNEL_META: Record<Channel, { icon: typeof Mail; color: string; fill: string }> = {
  sms: { icon: MessageSquareText, color: "text-channel-sms", fill: "var(--channel-sms)" },
  whatsapp: { icon: MessageCircle, color: "text-channel-whatsapp", fill: "var(--channel-whatsapp)" },
  email: { icon: Mail, color: "text-channel-email", fill: "var(--channel-email)" },
};

export function ChannelLabel({ channel, className }: { channel: Channel; className?: string }) {
  const { t } = useI18n();
  const { icon: Icon, color } = CHANNEL_META[channel];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <Icon className={cn("size-4", color)} aria-hidden />
      {t(`channel.${channel}`)}
    </span>
  );
}
