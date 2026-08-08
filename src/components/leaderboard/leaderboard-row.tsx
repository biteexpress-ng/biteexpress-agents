import type { LeaderboardRow as Row } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { TierBadge } from "@/components/tier/tier-badge";

/**
 * One standing.
 *
 * The rank sits in the same circular slot the award and ledger rows use for
 * their icon, so the board reads as part of the app rather than a scoreboard
 * bolted onto it. Nothing distinguishes the top three: the order already says
 * who is ahead, and medals would turn the one competitive surface in a calm
 * product into a game show.
 *
 * The viewer's own row sits on the sunken surface instead of the white one,
 * and carries a label too, so "where am I" is answerable without relying on
 * the fill alone.
 */
export function LeaderboardRow({ row }: { row: Row }) {
  const orders = row.activations === 1 ? "first order" : "first orders";
  const signups = row.signups === 1 ? "signup" : "signups";

  return (
    <li
      aria-current={row.is_you ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4",
        row.is_you
          ? "border-border-strong bg-canvas-sunken"
          : "border-border bg-surface shadow-soft",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold tabular-nums",
          row.is_you ? "bg-ink-200 text-ink-800" : "bg-canvas-sunken text-ink-700",
        )}
      >
        {row.rank}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "truncate text-base text-ink-900",
              row.is_you ? "font-semibold" : "font-medium",
            )}
          >
            <span className="sr-only">Rank {row.rank}. </span>
            {row.first_name}
            {row.is_you && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                (you)
              </span>
            )}
          </span>
          <TierBadge name={row.tier_name} compact />
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className="tabular-nums">{row.activations}</span> {orders}
          <span aria-hidden> · </span>
          <span className="tabular-nums">{row.signups}</span> {signups}
        </p>
      </div>
    </li>
  );
}
