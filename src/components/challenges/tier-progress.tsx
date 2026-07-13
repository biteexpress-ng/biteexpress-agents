import { CheckCircle2 } from "lucide-react";
import type { ChallengeTier } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Amount } from "@/components/ui/amount";

interface TierProgressProps {
  tier: ChallengeTier;
  signups: number;
  activations: number;
  /**
   * "primary" — the nearest unachieved tier, given a quiet brand emphasis.
   * "muted"   — a higher tier not yet in reach, present but recessed.
   * Achieved tiers ignore this and render their own calm done state.
   */
  emphasis?: "primary" | "muted";
  className?: string;
}

/**
 * The reusable heart of the challenge UI: one tier's two targets as labelled
 * progress bars, or a done state once earned. Colour is never the only signal —
 * every bar prints its fraction, and the achieved state carries a check + word,
 * not just green. Bonus amounts stay ink-900 (money is calm here); the win is
 * still on its way to the balance, so nothing reads as already-paid.
 */
export function TierProgress({
  tier,
  signups,
  activations,
  emphasis = "primary",
  className,
}: TierProgressProps) {
  if (tier.achieved) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft",
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <CheckCircle2
            className="size-5 shrink-0 text-[color:var(--color-success-strong)]"
            aria-hidden
          />
          <span className="truncate text-base font-semibold text-ink-900">
            {tier.name}
          </span>
          <span className="shrink-0 text-sm font-medium text-[color:var(--color-success-strong)]">
            Done
          </span>
        </div>
        <Amount
          value={tier.bonus_amount}
          className="shrink-0 text-base font-semibold"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface p-4 shadow-soft",
        emphasis === "primary" ? "border-brand-red/25" : "border-border",
        emphasis === "muted" && "opacity-70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-base font-semibold text-ink-900">
          {tier.name}
        </span>
        <Amount
          value={tier.bonus_amount}
          className="shrink-0 text-base font-semibold"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        <TierBar label="Signups" value={signups} max={tier.signup_target} />
        <TierBar
          label="First orders"
          value={activations}
          max={tier.activation_target}
        />
      </div>
    </div>
  );
}

function TierBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const clamped = Math.min(value, max);
  const scale = max > 0 ? clamped / max : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium text-ink-900">
          {value} / {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${value} of ${max}`}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-200"
      >
        <div
          className="tier-bar-fill h-full w-full origin-left bg-brand-red"
          style={{ transform: `scaleX(${scale})` }}
        />
      </div>
    </div>
  );
}
