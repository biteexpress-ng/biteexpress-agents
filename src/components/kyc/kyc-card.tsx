"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { getKyc } from "@/lib/api/agent";
import {
  ApiRequestError,
  type KycStatus,
  type KycStatusResponse,
} from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KycForm, identityTypeLabel } from "./kyc-form";

interface KycCardProps {
  onStatus?: (status: KycStatus) => void;
}

export function KycCard({ onStatus }: KycCardProps) {
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [kyc, setKyc] = useState<KycStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setState("loading");
    setError(null);
    try {
      const res = await getKyc();
      setKyc(res);
      setState("ready");
      onStatusRef.current?.(res.kyc_status);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't load your payout setup. Check your connection and try again.",
      );
      setState("error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      {state === "loading" && (
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-4 h-24 w-full" />
        </div>
      )}

      {state === "error" && (
        <div>
          <Alert tone="error">{error}</Alert>
          <Button
            variant="secondary"
            fullWidth
            className="mt-4"
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      )}

      {state === "ready" && kyc && <Body kyc={kyc} onSubmitted={load} />}
    </div>
  );
}

function Body({
  kyc,
  onSubmitted,
}: {
  kyc: KycStatusResponse;
  onSubmitted: () => void;
}) {
  if (kyc.kyc_status === "verified") {
    return (
      <div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-[color:var(--color-success-strong)]">
            <BadgeCheck className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-sans text-lg font-semibold text-ink-900">
              Payouts ready
            </h2>
            <p className="text-sm text-muted-foreground">
              Your identity and bank details are verified.
            </p>
          </div>
        </div>
        <BankSummary kyc={kyc} className="mt-4" />
        <p className="mt-4 text-sm text-muted-foreground">
          To change your bank details, contact support.
        </p>
      </div>
    );
  }

  if (kyc.kyc_status === "pending") {
    return (
      <div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning-soft text-[color:var(--color-warning)]">
            <Clock className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-sans text-lg font-semibold text-ink-900">
              Under review
            </h2>
            <p className="text-sm text-muted-foreground">
              We&apos;re reviewing your details — usually within a business day.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-4">
          {kyc.photo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={kyc.photo_url}
              alt=""
              className="size-16 shrink-0 rounded-xl border border-border object-cover"
            />
          )}
          <div className="min-w-0 text-sm">
            <p className="text-muted-foreground">
              {identityTypeLabel(kyc.identity_type)}
            </p>
            <BankSummary kyc={kyc} className="mt-1" compact />
          </div>
        </div>
      </div>
    );
  }

  // incomplete or rejected — show the form.
  return (
    <div>
      {kyc.kyc_status === "rejected" ? (
        <>
          <Alert tone="error" icon={<TriangleAlert className="size-5" />}>
            {kyc.rejection_reason ??
              "Your details couldn't be verified. Please check them and resubmit."}
          </Alert>
          <h2 className="mt-5 font-sans text-lg font-semibold text-ink-900">
            Fix and resubmit
          </h2>
        </>
      ) : (
        <>
          <h2 className="font-sans text-lg font-semibold text-ink-900">
            Set up payouts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            So we know where to send your money. Add your ID and bank details —
            it only takes a minute.
          </p>
        </>
      )}

      <div className="mt-5">
        <KycForm
          onSubmitted={onSubmitted}
          defaults={{
            bank_name: kyc.bank.bank_name ?? undefined,
            bank_account_name: kyc.bank.account_name ?? undefined,
          }}
        />
      </div>
    </div>
  );
}

function BankSummary({
  kyc,
  className,
  compact,
}: {
  kyc: KycStatusResponse;
  className?: string;
  compact?: boolean;
}) {
  if (!kyc.bank.bank_name) return null;
  return (
    <div className={className}>
      {!compact && (
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Bank account
        </p>
      )}
      <p className="text-base font-medium text-ink-900">{kyc.bank.bank_name}</p>
      <p className="tabular-nums text-ink-800">
        {kyc.bank.account_number_masked}
      </p>
      <p className="text-ink-800">{kyc.bank.account_name}</p>
    </div>
  );
}
