import { CHANNEL_META, ChannelLabel } from "@/components/app/ChannelLabel";
import type { DashboardSummary } from "@/lib/api/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";

export function ChannelDistribution({ channels }: { channels: DashboardSummary["channels"] }) {
  const { locale } = useI18n();
  const total = channels.reduce((a, c) => a + c.count, 0);
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Channel distribution">
        {channels.map((c) => (
          <div key={c.channel} style={{ width: `${(c.count / total) * 100}%`, background: CHANNEL_META[c.channel].fill }} />
        ))}
      </div>
      <ul className="flex flex-col divide-y">
        {channels.map((c) => (
          <li key={c.channel} className="flex items-center justify-between py-2.5 text-table">
            <ChannelLabel channel={c.channel} />
            <span className="flex items-baseline gap-3 tabular-nums">
              <span className="font-medium">{formatNumber(c.count, locale)}</span>
              <span className="w-12 text-end text-caption">{formatPercent((c.count / total) * 100, locale)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
