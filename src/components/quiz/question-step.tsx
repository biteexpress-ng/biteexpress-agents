"use client";

import { Check } from "lucide-react";
import type { QuizQuestion } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface QuestionStepProps {
  question: QuizQuestion;
  selected: number | undefined;
  onSelect: (optionIndex: number) => void;
}

export function QuestionStep({ question, selected, onSelect }: QuestionStepProps) {
  return (
    <fieldset>
      <legend className="mb-5 text-lg font-semibold text-ink-900">
        {question.question}
      </legend>
      <div className="flex flex-col gap-3">
        {question.options.map((option, i) => {
          const active = selected === i;
          return (
            <label
              key={i}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-base transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-red",
                active
                  ? "border-brand-red bg-[color-mix(in_srgb,var(--color-brand-red)_6%,#ffffff)] text-ink-900"
                  : "border-border text-ink-800 hover:border-border-strong hover:bg-canvas-sunken/50",
              )}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                className="sr-only"
                checked={active}
                onChange={() => onSelect(i)}
              />
              <span className="flex-1">{option}</span>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                  active
                    ? "border-brand-red bg-brand-red text-primary-foreground"
                    : "border-border-strong",
                )}
                aria-hidden
              >
                {active && <Check className="size-4" />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
