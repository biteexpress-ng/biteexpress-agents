"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { submitQuiz } from "@/lib/api/agent";
import {
  ApiRequestError,
  type QuizResult,
  type QuizStart,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { QuestionStep } from "./question-step";

interface QuizRunnerProps {
  quiz: QuizStart;
  onDone: (result: QuizResult) => void;
}

export function QuizRunner({ quiz, onDone }: QuizRunnerProps) {
  const questions = quiz.questions;
  const total = questions.length;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const current = questions[step];
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined,
  ).length;
  const allAnswered = answeredCount === total;
  const isLast = step === total - 1;

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitQuiz({
        attempt_id: quiz.attempt_id,
        answers,
      });
      onDone(result);
    } catch (err) {
      setSubmitError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't submit your quiz. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <section className="fade-up">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label="Previous question"
            className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-600 transition-colors hover:bg-canvas-sunken hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            Question {step + 1} of {total}
          </span>
          <span className="size-10" aria-hidden />
        </div>

        <ol className="mt-3 flex items-center gap-1.5" aria-hidden>
          {questions.map((q, i) => (
            <li
              key={q.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i === step
                  ? "bg-brand-red"
                  : answers[q.id] !== undefined
                    ? "bg-ink-400"
                    : "bg-ink-200",
              )}
            />
          ))}
        </ol>
      </div>

      <div key={current.id} className="slide-in">
        <QuestionStep
          question={current}
          selected={answers[current.id]}
          onSelect={(i) =>
            setAnswers((a) => ({ ...a, [current.id]: i }))
          }
        />
      </div>

      {submitError && (
        <Alert tone="error" className="mt-5">
          {submitError}
        </Alert>
      )}

      <div className="mt-6">
        {isLast ? (
          <>
            <Button
              fullWidth
              loading={submitting}
              disabled={!allAnswered}
              onClick={submit}
            >
              Submit quiz
            </Button>
            {!allAnswered && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Answer all {total} questions to submit — {total - answeredCount}{" "}
                left.
              </p>
            )}
          </>
        ) : (
          <Button fullWidth onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        )}
      </div>
    </section>
  );
}
