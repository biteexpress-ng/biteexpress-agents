"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/** Normalize common Nigerian phone formats to E.164 (+234…), else null. */
export function normalizeNgPhone(raw: string): string | null {
  const s = raw.replace(/[^\d+]/g, "");
  if (/^\+234\d{10}$/.test(s)) return s;
  if (/^234\d{10}$/.test(s)) return `+${s}`;
  if (/^0\d{10}$/.test(s)) return `+234${s.slice(1)}`;
  if (/^\d{10}$/.test(s)) return `+234${s}`;
  return null;
}

interface PhoneStepProps {
  onNext: (e164: string) => void;
  loading: boolean;
  error: string | null;
  /** Non-failure guidance, e.g. the 409 "already has an account" case. */
  guidance: string | null;
}

export function PhoneStep({ onNext, loading, error, guidance }: PhoneStepProps) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const e164 = normalizeNgPhone(value);
    if (!e164) {
      setLocalError("Enter a valid Nigerian phone number, like 0803… or +234803…");
      return;
    }
    setLocalError(null);
    onNext(e164);
  }

  return (
    <form onSubmit={submit} noValidate className="slide-in">
      <Field
        label="Customer's phone number"
        htmlFor="phone"
        error={localError ?? undefined}
        hint="Their Nigerian number — 0803… or +234803…"
      >
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          autoCorrect="off"
          placeholder="0803 000 0000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!localError}
          aria-describedby={localError ? "phone-error" : "phone-hint"}
        />
      </Field>

      {guidance && (
        <Alert tone="info" className="mt-4" live="status">
          {guidance}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <Button type="submit" fullWidth loading={loading} className="mt-6">
        Send code
      </Button>
    </form>
  );
}
