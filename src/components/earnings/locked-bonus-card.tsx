import { Lock } from "lucide-react";
import type { LockedBonus } from "@/lib/api/types";
import { formatDate, formatNaira } from "@/lib/format";

/**
 * The welcome bonus, credited but greyed out until the agent's first referral
 * places a delivered order. Deliberately muted (ink, never green, no "+") so it
 * never reads as spendable money, and it carries the exact unlock instruction.
 */
export function LockedBonusCard({ bonus }: { bonus: LockedBonus }) {
  const expires = formatDate(bonus.expires_at);

  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-canvas-sunken/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-200 text-ink-500">
          <Lock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-ink-600">
                Welcome bonus
              </span>
              <span className="rounded-full bg-ink-200 px-2 py-0.5 text-xs font-medium text-ink-600">
                Locked
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-base font-semibold text-ink-500">
              {formatNaira(bonus.amount)}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{bonus.message}</p>
          {expires && (
            <p className="mt-1 text-xs text-ink-500">
              Expires {expires} if not unlocked.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
