"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { buttonClassName, Button } from "@/components/ui/button";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

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
  const target = new Date(retryAt).getTime();
  const valid = Number.isFinite(target);
  const now = useNow(valid);
  const remaining = valid ? Math.max(0, target - now) : 0;
  const ready = !valid || remaining <= 0;

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
