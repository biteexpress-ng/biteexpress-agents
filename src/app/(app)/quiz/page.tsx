"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, TriangleAlert } from "lucide-react";
import { getQuizInfo, startQuiz } from "@/lib/api/agent";
import {
  ApiRequestError,
  type QuizInfo,
  type QuizResult,
  type QuizStart,
} from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth";
import { buttonClassName, Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { QuizResult as QuizResultView } from "@/components/quiz/quiz-result";
import { CooldownCard } from "@/components/quiz/cooldown-card";

type GateCode =
  | "training-incomplete"
  | "cooldown"
  | "no-questions"
  | "already-certified";
type Gate = { code: GateCode; retryAt?: string };
type Phase = "idle" | "active" | "gate" | "result";

function parseGate(err: unknown): Gate | null {
  if (!(err instanceof ApiRequestError) || err.status !== 403) return null;
  const raw = (err.raw ?? {}) as { code?: string; retry_at?: string };
  const code = (raw.code ?? err.errors[0]?.code) as GateCode | undefined;
  if (!code) return null;
  return { code, retryAt: raw.retry_at };
}

export default function QuizPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const setAgent = useAuthStore((s) => s.setAgent);

  const [phase, setPhase] = useState<Phase>("idle");
  const [quiz, setQuiz] = useState<QuizStart | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [info, setInfo] = useState<QuizInfo | null>(null);

  useEffect(() => {
    let active = true;
    getQuizInfo()
      .then((res) => {
        if (active) setInfo(res);
      })
      .catch(() => {
        // Non-blocking — the idle card still works without the preview numbers.
      });
    return () => {
      active = false;
    };
  }, []);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const q = await startQuiz();
      setQuiz(q);
      setGate(null);
      setResult(null);
      setPhase("active");
    } catch (err) {
      const g = parseGate(err);
      if (g) {
        if (g.code === "already-certified") {
          router.replace("/");
          return;
        }
        setGate(g);
        setPhase("gate");
      } else {
        setStartError(
          err instanceof ApiRequestError
            ? err.message
            : "Couldn't start the quiz. Check your connection and try again.",
        );
      }
    } finally {
      setStarting(false);
    }
  }

  function handleDone(r: QuizResult) {
    setResult(r);
    setPhase("result");
    if (r.status === "passed" && r.certified && agent) {
      // Unlock the certified shell immediately.
      setAgent({
        ...agent,
        certified: true,
        training_complete: true,
        status: "certified",
        referral_code: r.referral_code ?? agent.referral_code,
      });
    }
  }

  const firstName = (agent?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  if (phase === "active" && quiz) {
    return <QuizRunner quiz={quiz} onDone={handleDone} />;
  }

  if (phase === "result" && result) {
    return (
      <QuizResultView
        result={result}
        firstName={firstName}
        onDashboard={() => router.replace("/")}
        onRetry={start}
        retrying={starting}
      />
    );
  }

  if (phase === "gate" && gate) {
    if (gate.code === "cooldown" && gate.retryAt) {
      return (
        <CooldownCard
          retryAt={gate.retryAt}
          onRetry={start}
          retrying={starting}
        />
      );
    }
    if (gate.code === "training-incomplete") {
      return (
        <GateCardView
          title="Finish training first"
          body="Watch all the training videos, then come back to take the quiz."
          actionLabel="Go to training"
        />
      );
    }
    if (gate.code === "no-questions") {
      return (
        <GateCardView
          title="No quiz available yet"
          body="The certification quiz isn't ready yet. Check back soon — you'll be able to take it right here."
          actionLabel="Back to training"
        />
      );
    }
    // cooldown without a retry_at
    return (
      <GateCardView
        title="Take a short break"
        body="You can try the quiz again shortly. Rewatch the training videos while you wait."
        actionLabel="Back to training"
      />
    );
  }

  // idle
  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">
        Certification quiz
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pass the quiz to get certified and unlock your referral code.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <span className="grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-red)_10%,#ffffff)] text-brand-red">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-sans text-lg font-semibold text-ink-900">
          Ready when you are
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer every question. You can retake after a short break if you
          don&apos;t pass. Once you start, your questions are drawn — so find a
          quiet moment.
        </p>

        {info && (
          <dl className="mt-5 flex items-stretch divide-x divide-border rounded-xl border border-border text-center">
            <div className="flex-1 px-2 py-3">
              <dt className="text-sm text-muted-foreground">Questions</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
                {info.question_count}
              </dd>
            </div>
            <div className="flex-1 px-2 py-3">
              <dt className="text-sm text-muted-foreground">To pass</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
                {info.pass_mark}%
              </dd>
            </div>
          </dl>
        )}

        {startError && (
          <Alert
            tone="error"
            icon={<TriangleAlert className="size-5" />}
            className="mt-4"
          >
            {startError}
          </Alert>
        )}

        <Button className="mt-5" fullWidth loading={starting} onClick={start}>
          Start quiz
        </Button>
      </div>
    </section>
  );
}

function GateCardView({
  title,
  body,
  actionLabel,
}: {
  title: string;
  body: string;
  actionLabel: string;
}) {
  return (
    <section className="fade-up">
      <div className="mt-2 rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-canvas-sunken text-ink-600">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-sans text-lg font-semibold text-ink-900">
          {title}
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {body}
        </p>
        <Link
          href="/training"
          className={buttonClassName({
            variant: "secondary",
            fullWidth: true,
            className: "mt-6",
          })}
        >
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
