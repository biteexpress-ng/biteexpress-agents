"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { QuizResult as QuizResultData } from "@/lib/api/types";
import { buttonClassName, Button } from "@/components/ui/button";
import { ReferralCodeCard } from "@/components/home/referral-code-card";

/** Format a pass/score threshold whose unit (count vs percent) the API
 *  doesn't declare: treat values ≤ question count as a raw count. */
function scoreLabel(value: number, total: number): string {
  return value <= total ? `${value} of ${total}` : `${value}%`;
}

interface QuizResultProps {
  result: QuizResultData;
  total: number;
  firstName: string;
  onDashboard: () => void;
  onRetry: () => void;
  retrying: boolean;
}

export function QuizResult({
  result,
  total,
  firstName,
  onDashboard,
  onRetry,
  retrying,
}: QuizResultProps) {
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
        You got{" "}
        <span className="font-semibold tabular-nums text-ink-900">
          {scoreLabel(result.score, total)}
        </span>{" "}
        right. You needed {scoreLabel(result.pass_mark, total)} to pass.
      </p>
      <p className="mx-auto mt-4 max-w-xs text-base text-ink-800">
        Rewatch the videos and try again after a short break. You&apos;ve got this.
      </p>

      <Button
        fullWidth
        className="mt-8"
        loading={retrying}
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
