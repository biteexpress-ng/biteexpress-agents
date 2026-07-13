import { formatNaira } from "@/lib/format";
import { StatPair } from "@/components/ui/stat-pair";

interface BalanceHeaderProps {
  balances: { withdrawable: number; earned_total: number };
}

/**
 * Withdrawable is the hero number — the thing agents open this screen to check.
 * earned_total sits quietly beside it. `pending` is intentionally hidden while
 * it's always 0 in Phase B (dead numbers erode trust); it returns in Phase D.
 */
export function BalanceHeader({ balances }: BalanceHeaderProps) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">Withdrawable balance</p>
      <p className="mt-1 text-[2.75rem] font-semibold leading-none tabular-nums text-ink-900">
        {formatNaira(balances.withdrawable)}
      </p>
      <div className="mt-6">
        <StatPair
          label="Earned all time"
          value={formatNaira(balances.earned_total)}
        />
      </div>
    </div>
  );
}
