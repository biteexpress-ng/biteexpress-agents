import { CalendarClock } from "lucide-react";
import type { ChallengeCurrent } from "@/lib/api/types";
import { StatPair } from "@/components/ui/stat-pair";

/**
 * Format the week's end as a plain, informational deadline in the device's local
 * time (Lagos for agents) — "Ends Sunday, 11:59 PM". Deliberately a day + time,
 * never a live countdown: no urgency pressure near money.
 */
function formatDeadline(weekEndsAt: string): string | null {
  const d = new Date(weekEndsAt);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Ends ${weekday}, ${time}`;
}

export function WeekHeader({ current }: { current: ChallengeCurrent }) {
  const deadline = formatDeadline(current.week_ends_at);

  return (
    <div>
      <h1 className="font-sans text-xl font-semibold text-ink-900">
        This week&apos;s challenge
      </h1>
      {deadline && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          {deadline}
        </p>
      )}

      <div className="mt-4 flex gap-8">
        <StatPair label="Signups" value={current.signups} />
        <StatPair label="First orders" value={current.activations} />
      </div>
    </div>
  );
}
