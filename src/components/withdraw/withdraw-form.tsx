"use client";

import { useState } from "react";
import { CircleCheckBig, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { requestWithdraw } from "@/lib/api/agent";
import { ApiRequestError, type KycStatusResponse } from "@/lib/api/types";
import { gateMessage } from "@/lib/api/messages";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

interface WithdrawFormProps {
  available: number;
  min: number;
  bank: KycStatusResponse["bank"];
  onSubmitted: () => void;
}

export function WithdrawForm({
  available,
  min,
  bank,
  onSubmitted,
}: WithdrawFormProps) {
  const [phase, setPhase] = useState<"form" | "confirm" | "success">("form");
  const [amountStr, setAmountStr] = useState("");
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): number | null {
    const schema = z
      .coerce.number({ message: "Enter an amount" })
      .positive("Enter an amount")
      .min(min, `Minimum withdrawal is ${formatNaira(min)}`)
      .max(available, "That's more than your balance");
    const parsed = schema.safeParse(amountStr);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid amount");
      return null;
    }
    setError(null);
    return parsed.data;
  }

  function toConfirm(e: React.FormEvent) {
    e.preventDefault();
    const value = validate();
    if (value == null) return;
    setAmount(value);
    setPhase("confirm");
  }

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await requestWithdraw({ amount });
      setPhase("success");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const code = err.errors[0]?.code;
        setError(code ? gateMessage(code, { min }) : err.message);
      } else {
        setError("Couldn't send your request. Check your connection and try again.");
      }
      setPhase("form");
    } finally {
      setSubmitting(false);
    }
  }

  const destination = bank.bank_name
    ? `${bank.bank_name} ${bank.account_number_masked ?? ""} — ${bank.account_name ?? ""}`
    : "your bank account";

  if (phase === "success") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success-soft text-[color:var(--color-success-strong)]">
          <CircleCheckBig className="size-7" aria-hidden />
        </div>
        <h2 className="font-sans text-lg font-semibold text-ink-900">
          Request sent
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          We&apos;ll review it and pay{" "}
          <span className="font-medium tabular-nums text-ink-900">
            {formatNaira(amount)}
          </span>{" "}
          to your account.
        </p>
        <Button className="mt-6" fullWidth onClick={onSubmitted}>
          Done
        </Button>
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-sans text-lg font-semibold text-ink-900">
          Confirm withdrawal
        </h2>
        <dl className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Amount</dt>
            <dd className="text-lg font-semibold tabular-nums text-ink-900">
              {formatNaira(amount)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-sm text-muted-foreground">To</dt>
            <dd className="text-right text-sm font-medium text-ink-900">
              {destination}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setPhase("form")}
            disabled={submitting}
          >
            Back
          </Button>
          <Button fullWidth loading={submitting} onClick={confirm}>
            Confirm withdrawal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={toConfirm}
      noValidate
      className="rounded-2xl border border-border bg-surface p-5 shadow-soft"
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="amount" className="text-sm font-medium text-ink-800">
          Amount to withdraw
        </label>
        <button
          type="button"
          onClick={() => {
            setAmountStr(String(available));
            setError(null);
          }}
          className="cursor-pointer text-sm font-medium text-brand-red"
        >
          Withdraw all
        </button>
      </div>

      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-ink-500">
          ₦
        </span>
        <Input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="pl-8 tabular-nums"
          aria-invalid={!!error}
          aria-describedby={error ? "amount-error" : "amount-hint"}
        />
      </div>
      <p id="amount-hint" className="mt-1.5 text-sm text-muted-foreground">
        Available {formatNaira(available)} · Minimum {formatNaira(min)}
      </p>

      {error && (
        <Alert tone="error" icon={<TriangleAlert className="size-5" />} className="mt-4">
          {error}
        </Alert>
      )}

      <Button type="submit" fullWidth className="mt-5">
        Continue
      </Button>
    </form>
  );
}
