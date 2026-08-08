import { CalendarClock } from "lucide-react";
import type { ChallengeCurrent } from "@/lib/api/types";
import { formatWeekDeadline } from "@/lib/format";
import { StatPair } from "@/components/ui/stat-pair";

export function WeekHeader({ current }: { current: ChallengeCurrent }) {
  const deadline = formatWeekDeadline(current.week_ends_at);

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
