"use client";

import Link from "next/link";
import { CircleCheckBig } from "lucide-react";
import { buttonClassName, Button } from "@/components/ui/button";

interface DoneStepProps {
  maskedName: string;
  onAnother: () => void;
}

export function DoneStep({ maskedName, onAnother }: DoneStepProps) {
  return (
    <section className="slide-in text-center">
      <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success-soft text-[color:var(--color-success-strong)]">
        <CircleCheckBig className="size-8" aria-hidden />
      </div>
      <h2 className="font-sans text-2xl font-semibold text-ink-900">
        {maskedName} is in
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-base text-muted-foreground">
        Their account is set up on their phone. It counts toward your earnings
        once their first order is delivered.
      </p>

      <Button fullWidth className="mt-8" onClick={onAnother}>
        Sign up another
      </Button>
      <Link
        href="/customers"
        className={buttonClassName({
          variant: "secondary",
          fullWidth: true,
          className: "mt-3",
        })}
      >
        View my customers
      </Link>
    </section>
  );
}
