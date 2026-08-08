import { cn } from "@/lib/utils";

interface TierBadgeProps {
  /** Tier name, or null when tiers are off or the agent has not reached one. */
  name: string | null | undefined;
  /** Tighter, name-only variant for dense rows such as the leaderboard. */
  compact?: boolean;
  className?: string;
}

/**
 * The agent's standing, as a nameplate.
 *
 * Every other chip in this app is semantic and coloured: green verified, amber
 * in review, red needs fixing. This one is deliberately the only achromatic
 * chip in the set. A tier is not a state that needs acting on, and colouring it
 * would put it in competition with the badges that do. Weight and a hairline
 * border carry the pride instead of hue, which is also what keeps it readable
 * in daylight where a tint would wash out.
 *
 * Renders nothing at all without a name, so every caller can pass the payload
 * straight through and older backends simply produce no badge.
 */
export function TierBadge({ name, compact, className }: TierBadgeProps) {
  const label = (name ?? "").trim();
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border-strong bg-canvas-sunken font-medium text-ink-800",
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
    >
      {compact ? label : `${label} agent`}
    </span>
  );
}
