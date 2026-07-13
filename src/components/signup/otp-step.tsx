"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/lib/hooks/use-countdown";

interface OtpStepProps {
  phone: string;
  onNext: (otp: string) => void;
  onResend: () => void;
  resending: boolean;
  error: string | null;
}

const LENGTH = 6;

export function OtpStep({ phone, onNext, onResend, resending, error }: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendAt, setResendAt] = useState(() =>
    new Date(Date.now() + 60_000).toISOString(),
  );
  const { remaining, expired } = useCountdown(resendAt);

  const otp = digits.join("");
  const complete = otp.length === LENGTH;

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < LENGTH - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    refs.current[Math.min(text.length, LENGTH - 1)]?.focus();
  }

  function resend() {
    onResend();
    setResendAt(new Date(Date.now() + 60_000).toISOString());
    setDigits(Array(LENGTH).fill(""));
    refs.current[0]?.focus();
  }

  return (
    <div className="slide-in">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-ink-900">{phone}</span>. Ask them for it.
      </p>

      <div
        className="mt-5 flex justify-between gap-2"
        role="group"
        aria-label="One-time code"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            className="h-12 w-full min-w-0 rounded-xl border border-border bg-surface text-center font-mono text-xl text-ink-900 shadow-hairline focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/70"
          />
        ))}
      </div>

      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <Button
        fullWidth
        className="mt-6"
        disabled={!complete}
        onClick={() => onNext(otp)}
      >
        Continue
      </Button>

      <div className="mt-4 text-center text-sm">
        {expired ? (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className={cn(
              "cursor-pointer font-medium text-brand-red underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red",
              resending && "opacity-60",
            )}
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        ) : (
          <span className="text-muted-foreground">
            Resend code in{" "}
            <span className="tabular-nums">{Math.ceil(remaining / 1000)}s</span>
          </span>
        )}
      </div>
    </div>
  );
}
