"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getChallenge, getLeaderboard } from "@/lib/api/agent";
import type {
  ChallengeAward,
  ChallengeCurrent,
  LeaderboardResponse,
} from "@/lib/api/types";
import { formatNaira } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekHeader } from "@/components/challenges/week-header";
import { TierProgress } from "@/components/challenges/tier-progress";
import { AwardRow } from "@/components/challenges/award-row";
import { LeaderboardSection } from "@/components/leaderboard/leaderboard-section";

type State =
  | { phase: "loading" }
  | { phase: "redirect" }
  | { phase: "error" }
  | {
      phase: "ready";
      current: ChallengeCurrent | null;
      past_awards: ChallengeAward[];
      board: LeaderboardResponse | null;
    };

/** Off, unreachable, or from a backend that predates H1: all mean "no board". */
const NO_BOARD: LeaderboardResponse = { enabled: false };

export default function ChallengesPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(() => {
    let active = true;
    setState({ phase: "loading" });

    // The board is a bonus on this screen: a failure there must never take the
    // challenge down with it, so it degrades to "no board" instead of throwing.
    Promise.all([getChallenge(), getLeaderboard().catch(() => NO_BOARD)])
      .then(([challenge, board]) => {
        if (!active) return;

        const challengeLive = challenge.active && challenge.current !== null;
        const boardLive = board.enabled === true;

        // Nothing on this screen is live. Leave quietly; deep links stay safe.
        if (!challengeLive && !boardLive) {
          setState({ phase: "redirect" });
          router.replace("/");
          return;
        }

        setState({
          phase: "ready",
          current: challengeLive ? challenge.current : null,
          past_awards: challengeLive ? challenge.past_awards : [],
          board: boardLive ? board : null,
        });
      })
      .catch(() => {
        if (active) setState({ phase: "error" });
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => load(), [load]);

  if (state.phase === "loading" || state.phase === "redirect") {
    return <ChallengesSkeleton />;
  }

  if (state.phase === "error") {
    return (
      <section className="fade-up">
        <h1 className="font-sans text-xl font-semibold text-ink-900">
          This week&apos;s challenge
        </h1>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center shadow-soft">
          <p className="text-base font-medium text-ink-900">
            Couldn&apos;t load your challenge
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button variant="secondary" fullWidth className="mt-5" onClick={load}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const { current, past_awards, board } = state;
  const viewer = {
    firstName: (agent?.full_name ?? "").trim().split(/\s+/)[0] ?? "",
    tierName: agent?.tier?.name ?? null,
  };

  return (
    <section className="fade-up">
      {current && (
        <>
          <ChallengeBlock current={current} past_awards={past_awards} />
          {board && <hr className="mt-8 border-border" />}
        </>
      )}

      {board && (
        <div className={current ? "mt-8" : undefined}>
          <LeaderboardSection
            board={board}
            viewer={viewer}
            as={current ? "h2" : "h1"}
          />
        </div>
      )}
    </section>
  );
}

function ChallengeBlock({
  current,
  past_awards,
}: {
  current: ChallengeCurrent;
  past_awards: ChallengeAward[];
}) {
  // Tiers are ascending and achieved tiers are always a prefix, so the first
  // unachieved tier is the one to lean on; higher tiers stay present but muted.
  const nearestIdx = current.tiers.findIndex((t) => !t.achieved);
  const achievedTier = current.achieved_tier
    ? current.tiers.find((t) => t.name === current.achieved_tier)
    : undefined;

  return (
    <>
      <WeekHeader current={current} />

      {achievedTier && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-success/25 bg-success-soft p-4">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-success-strong)]"
            aria-hidden
          />
          <p className="text-base text-ink-900">
            You&apos;ve earned the {achievedTier.name} bonus.{" "}
            <span className="font-semibold tabular-nums">
              {formatNaira(achievedTier.bonus_amount)}
            </span>{" "}
            is paid to your balance on Monday.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {current.tiers.map((tier, i) => (
          <TierProgress
            key={`${tier.name}-${i}`}
            tier={tier}
            signups={current.signups}
            activations={current.activations}
            emphasis={i === nearestIdx ? "primary" : "muted"}
          />
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-sans text-base font-semibold text-ink-900">
          Past wins
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {past_awards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Your challenge wins will show up here.
              </p>
            </div>
          ) : (
            past_awards.map((award) => (
              <AwardRow key={award.week_key} award={award} />
            ))
          )}
        </div>
      </section>
    </>
  );
}

function ChallengesSkeleton() {
  return (
    <section>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-4 flex gap-8">
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-10 w-16" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </section>
  );
}
