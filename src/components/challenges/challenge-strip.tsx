"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Trophy } from "lucide-react";
import { getChallenge } from "@/lib/api/agent";
import type { ChallengeStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/format";

/**
 * The daily-glance entry point to the challenge, sitting under the home numbers.
 * Shows the nearest unachieved tier's cash + signup progress, or the earned state
 * once a tier is won. Self-fetches; on any failure or when the feature is off it
 * renders nothing — the home screen never shows a challenge error.
 */
export function ChallengeStrip({
  className,
  onVisible,
}: {
  className?: string;
  /**
   * Whether this strip ended up rendering anything. Home uses it to decide
   * whether the city-board card is needed, so the two never stack.
   */
  onVisible?: (visible: boolean) => void;
}) {
  const [data, setData] = useState<ChallengeStatus | null>(null);

  useEffect(() => {
    let active = true;
    getChallenge()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        // Silent: the strip is a bonus on the home screen, never an error card.
        if (active) setData({ active: false, current: null, past_awards: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const current = data?.active ? data.current : null;
  const achieved =
    current && current.achieved_tier
      ? current.tiers.find((t) => t.name === current.achieved_tier)
      : undefined;
  const nearest = current?.tiers.find((t) => !t.achieved);
  // Reported from the same condition the render below uses, so home can never
  // hide its own card next to a strip that decided not to draw.
  const visible = Boolean(current && (achieved || nearest));

  // Reported after the fetch settles, never during render. onVisible is
  // deliberately not a dependency: it is a parent setter whose identity changes
  // on every home render, and re-reporting the same boolean helps nobody.
  const report = useRef(onVisible);
  report.current = onVisible;
  useEffect(() => {
    if (data) report.current?.(visible);
  }, [data, visible]);

  if (!current) return null;

  const cardClass = cn(
    "block rounded-2xl border border-border bg-surface p-4 shadow-soft transition-colors hover:bg-canvas-sunken/50",
    className,
  );

  if (achieved) {
    return (
      <Link
        href="/challenges"
        aria-label={`${achieved.name} bonus earned. ${formatNaira(achieved.bonus_amount)} is paid to your balance on Monday. View challenge.`}
        className={cardClass}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_12%,#ffffff)] text-[color:var(--color-success-strong)]">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              This week&apos;s challenge
            </p>
            <p className="mt-0.5 text-base font-medium text-ink-900">
              {achieved.name} bonus earned ·{" "}
              <span className="tabular-nums font-semibold">
                {formatNaira(achieved.bonus_amount)}
              </span>{" "}
              Monday
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
        </div>
      </Link>
    );
  }

  if (!nearest) return null;
  const scale =
    nearest.signup_target > 0
      ? Math.min(1, current.signups / nearest.signup_target)
      : 0;

  return (
    <Link
      href="/challenges"
      aria-label={`This week's challenge: ${formatNaira(nearest.bonus_amount)} bonus for ${current.signups} of ${nearest.signup_target} signups. View challenge.`}
      className={cardClass}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-red/10 text-brand-red">
          <Trophy className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            This week&apos;s challenge
          </p>
          <p className="mt-0.5 text-base font-medium text-ink-900">
            <span className="tabular-nums font-semibold">
              {formatNaira(nearest.bonus_amount)}
            </span>{" "}
            this week ·{" "}
            <span className="tabular-nums">
              {current.signups} of {nearest.signup_target}
            </span>{" "}
            signups
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
      </div>

      {/* Decorative here: the link's accessible name already states the numbers. */}
      <div
        aria-hidden
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
      >
        <div
          className="tier-bar-fill h-full w-full origin-left bg-brand-red"
          style={{ transform: `scaleX(${scale})` }}
        />
      </div>
    </Link>
  );
}
