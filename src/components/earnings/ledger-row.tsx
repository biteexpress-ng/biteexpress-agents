import { Gift, RotateCcw, ShoppingBag, Sparkles, Trophy } from "lucide-react";
import type { LedgerEntry } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Amount } from "@/components/ui/amount";

const TYPE_META: Record<
  LedgerEntry["type"],
  { label: string; Icon: typeof ShoppingBag }
> = {
  order_commission: { label: "Order commission", Icon: ShoppingBag },
  reversal: { label: "Refund reversal", Icon: RotateCcw },
  challenge_bonus: { label: "Challenge bonus", Icon: Trophy },
  manual_bonus: { label: "Bonus", Icon: Gift },
};

export function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const meta = TYPE_META[entry.type] ?? {
    label: "Adjustment",
    Icon: Sparkles,
  };
  const Icon = meta.Icon;
  const isReversal = entry.type === "reversal";
  const isReversedOriginal = entry.status === "reversed";
  const subtitle = entry.order_id ? `Order #${entry.order_id}` : entry.note;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft",
        isReversal && "opacity-75",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full bg-canvas-sunken",
          isReversal ? "text-ink-500" : "text-ink-700",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-medium text-ink-900">
            {meta.label}
          </span>
          {isReversedOriginal && (
            <span className="shrink-0 rounded-full bg-canvas-sunken px-2 py-0.5 text-xs font-medium text-ink-500">
              reversed
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {subtitle && <span aria-hidden>·</span>}
          <span className="shrink-0 tabular-nums">
            {formatDate(entry.created_at)}
          </span>
        </div>
      </div>

      <Amount value={entry.amount} sign className="shrink-0 text-base font-semibold" />
    </div>
  );
}
