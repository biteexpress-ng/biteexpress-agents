"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { buttonClassName, Button } from "@/components/ui/button";
import { formatRemaining, useCountdown } from "@/lib/hooks/use-countdown";

interface CooldownCardProps {
  retryAt: string;
  onRetry: () => void;
  retrying: boolean;
}

/**
 * Shown when the quiz is on cooldown after a failed attempt. Live countdown to
 * retry_at; once it reaches zero the "Start quiz" action unlocks.
 */
export function CooldownCard({ retryAt, onRetry, retrying }: CooldownCardProps) {
  const { remaining, expired: ready } = useCountdown(retryAt);

  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">
        Take a short break
      </h1>
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-canvas-sunken text-ink-600">
          <Clock className="size-6" aria-hidden />
        </span>

        {ready ? (
          <>
            <p className="mt-4 text-base font-medium text-ink-900">
              You&apos;re ready to try again
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Take your time and give it another go.
            </p>
            <Button
              className="mt-6"
              fullWidth
              loading={retrying}
              onClick={onRetry}
            >
              Start quiz
            </Button>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              You can try the quiz again in
            </p>
            <p
              className="mt-1 font-mono text-4xl font-semibold tabular-nums text-ink-900"
              aria-live="polite"
            >
              {formatRemaining(remaining)}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Rewatch the training videos while you wait — it helps.
            </p>
            <Link
              href="/training"
              className={buttonClassName({
                variant: "secondary",
                fullWidth: true,
                className: "mt-6",
              })}
            >
              Back to training
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
