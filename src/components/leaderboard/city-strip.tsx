"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { getLeaderboard } from "@/lib/api/agent";
import type { LeaderboardResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * The way to /challenges when the challenge itself is off and the board is the
 * only thing living there.
 *
 * Home already has one card pointing at that screen when the challenge strip
 * renders, so this only appears in its absence. Self-fetches and stays silent
 * on any failure, because the home screen never shows an error for a bonus.
 */
export function CityStrip({ className }: { className?: string }) {
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);

  useEffect(() => {
    let active = true;
    getLeaderboard()
      .then((d) => {
        if (active) setBoard(d);
      })
      .catch(() => {
        // Silent by design.
      });
    return () => {
      active = false;
    };
  }, []);

  // No city means no board for this agent, so there is nothing to point at.
  if (!board?.enabled || !board.city_label) return null;

  const you = board.you;
  const standing = you
    ? `You are ${ordinal(you.rank)} this week.`
    : "See how you compare.";

  return (
    <Link
      href="/challenges"
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition-colors hover:bg-canvas-sunken/50",
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas-sunken text-ink-700">
        <Users className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">Your city this week</p>
        <p className="mt-0.5 truncate text-base font-medium text-ink-900">
          {board.city_label} · {standing}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
    </Link>
  );
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
