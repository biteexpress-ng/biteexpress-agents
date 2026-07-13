import { Trophy } from "lucide-react";
import type { ChallengeAward } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { Amount } from "@/components/ui/amount";

/**
 * A past challenge win. The bonus was credited to the available balance, so it
 * reads as a settled credit (green +₦), matching how the same row appears in the
 * earnings ledger.
 */
export function AwardRow({ award }: { award: ChallengeAward }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas-sunken text-ink-700">
        <Trophy className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-ink-900">
          {award.tier_name}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0 tabular-nums">{award.week_key}</span>
          <span aria-hidden>·</span>
          <span className="truncate">Paid {formatDate(award.awarded_at)}</span>
        </p>
      </div>

      <Amount
        value={award.bonus_amount}
        sign
        className="shrink-0 text-base font-semibold"
      />
    </div>
  );
}
