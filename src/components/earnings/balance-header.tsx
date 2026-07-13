import { formatNaira } from "@/lib/format";
import { StatPair } from "@/components/ui/stat-pair";

interface BalanceHeaderProps {
  balances: { withdrawable: number; pending: number; earned_total: number };
}

/**
 * Available is the hero number — the thing agents open this screen to check.
 * earned_total and (only when in flight) pending sit quietly beside it.
 */
export function BalanceHeader({ balances }: BalanceHeaderProps) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">Available balance</p>
      <p className="mt-1 text-[2.75rem] font-semibold leading-none tabular-nums text-ink-900">
        {formatNaira(balances.withdrawable)}
      </p>
      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
        <StatPair
          label="Earned all time"
          value={formatNaira(balances.earned_total)}
        />
        {balances.pending > 0 && (
          <StatPair
            label="Being paid out"
            value={formatNaira(balances.pending)}
          />
        )}
      </div>
    </div>
  );
}
