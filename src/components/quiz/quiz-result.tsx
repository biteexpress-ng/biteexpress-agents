"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { QuizResult as QuizResultData } from "@/lib/api/types";
import { buttonClassName, Button } from "@/components/ui/button";
import { ReferralCodeCard } from "@/components/home/referral-code-card";
import { formatRemaining, useCountdown } from "@/lib/hooks/use-countdown";

interface QuizResultProps {
  result: QuizResultData;
  firstName: string;
  onDashboard: () => void;
  onRetry: () => void;
  retrying: boolean;
}

export function QuizResult({
  result,
  firstName,
  onDashboard,
  onRetry,
  retrying,
}: QuizResultProps) {
  // Called unconditionally (hooks rule); harmless for the pass branch, where
  // retry_at is absent and the countdown reports expired immediately.
  const { remaining, expired } = useCountdown(result.retry_at);
  const passed = result.status === "passed" && result.certified;

  if (passed) {
    return (
      <section className="fade-up text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--color-success-strong)]">
          Certified
        </p>
        {/* One of only two serif display moments in the app. */}
        <h1 className="mt-2 text-balance font-serif text-3xl leading-tight text-ink-900">
          You&apos;re certified{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-base text-muted-foreground">
          Every customer who signs up with your code now earns you commission.
          Share it to get your first one.
        </p>

        {result.referral_code ? (
          <ReferralCodeCard
            code={result.referral_code}
            className="reveal-pass mt-8 text-left"
          />
        ) : (
          <p className="mt-8 text-base text-ink-800">
            Your referral code is ready on your dashboard.
          </p>
        )}

        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          onClick={onDashboard}
        >
          Go to my dashboard
        </Button>
      </section>
    );
  }

  return (
    <section className="fade-up text-center">
      <h1 className="font-sans text-2xl font-semibold text-ink-900">
        Not quite this time
      </h1>
      <p className="mx-auto mt-3 max-w-xs text-base text-muted-foreground">
        You scored{" "}
        <span className="font-semibold tabular-nums text-ink-900">
          {result.score}%
        </span>
        . You needed{" "}
        <span className="tabular-nums">{result.pass_mark}%</span> to pass.
      </p>
      <p className="mx-auto mt-4 max-w-xs text-base text-ink-800">
        Rewatch the videos and try again after a short break. You&apos;ve got this.
      </p>

      {!expired && (
        <p className="mt-6 text-sm text-muted-foreground">
          You can try again in{" "}
          <span
            className="font-mono font-semibold tabular-nums text-ink-900"
            aria-live="polite"
          >
            {formatRemaining(remaining)}
          </span>
        </p>
      )}

      <Button
        fullWidth
        className="mt-4"
        loading={retrying}
        disabled={!expired}
        onClick={onRetry}
      >
        <RotateCcw className="size-5" aria-hidden />
        Try the quiz again
      </Button>
      <Link
        href="/training"
        className={buttonClassName({
          variant: "secondary",
          fullWidth: true,
          className: "mt-3",
        })}
      >
        Back to training
      </Link>
    </section>
  );
}
