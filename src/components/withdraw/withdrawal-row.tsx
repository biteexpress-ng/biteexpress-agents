import type { WithdrawalEntry } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatDate, formatNaira } from "@/lib/format";

const STATUS_META: Record<
  WithdrawalEntry["status"],
  { label: string; chip: string }
> = {
  pending: {
    label: "Reviewing",
    chip: "bg-warning-soft text-[color:var(--color-warning)]",
  },
  approved: {
    label: "Paid",
    chip: "bg-success-soft text-[color:var(--color-success-strong)]",
  },
  denied: {
    label: "Declined",
    chip: "bg-canvas-sunken text-ink-500",
  },
};

export function WithdrawalRow({ withdrawal }: { withdrawal: WithdrawalEntry }) {
  const meta = STATUS_META[withdrawal.status];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Money stays ink — never colored; the chip carries the status. */}
          <p className="text-base font-semibold tabular-nums text-ink-900">
            {formatNaira(withdrawal.amount)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Requested {formatDate(withdrawal.created_at)}
            {withdrawal.status === "approved" && withdrawal.processed_at
              ? ` · Paid ${formatDate(withdrawal.processed_at)}`
              : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            meta.chip,
          )}
        >
          {meta.label}
        </span>
      </div>

      {withdrawal.status === "denied" && withdrawal.admin_note && (
        <p className="mt-2 border-t border-border pt-2 text-sm text-ink-600">
          {withdrawal.admin_note}
        </p>
      )}
    </div>
  );
}
