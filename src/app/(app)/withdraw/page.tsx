"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEarnings, getKyc, getWithdrawals } from "@/lib/api/agent";
import {
  ApiRequestError,
  type EarningsResponse,
  type KycStatusResponse,
  type WithdrawalEntry,
  type WithdrawalsResponse,
  type WithdrawEligibility,
} from "@/lib/api/types";
import { gateMessage } from "@/lib/api/messages";
import { buttonClassName, Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginatedList } from "@/components/ui/paginated-list";
import { WithdrawForm } from "@/components/withdraw/withdraw-form";
import { WithdrawalRow } from "@/components/withdraw/withdrawal-row";

export default function WithdrawPage() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [earnings, setEarnings] = useState<EarningsResponse | null>(null);
  const [kyc, setKyc] = useState<KycStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  async function load() {
    setState("loading");
    setError(null);
    try {
      const [e, k] = await Promise.all([getEarnings(1), getKyc()]);
      setEarnings(e);
      setKyc(k);
      setState("ready");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't load this. Check your connection and try again.",
      );
      setState("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onSubmitted() {
    setHistoryKey((k) => k + 1);
    void load();
  }

  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">Withdraw</h1>

      {state === "loading" && (
        <div className="mt-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}

      {state === "error" && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
          <Button
            variant="secondary"
            fullWidth
            className="mt-4"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      )}

      {state === "ready" && earnings && kyc && (
        <>
          <div className="mt-6">
            {earnings.eligibility.can_withdraw ? (
              <WithdrawForm
                available={earnings.balances.withdrawable}
                min={earnings.eligibility.min_amount}
                bank={kyc.bank}
                onSubmitted={onSubmitted}
              />
            ) : (
              <ReasonState eligibility={earnings.eligibility} />
            )}
          </div>

          <h2 className="mt-8 font-sans text-base font-semibold text-ink-900">
            Payout history
          </h2>
          <div className="mt-4">
            <PaginatedList<WithdrawalEntry, WithdrawalsResponse>
              key={historyKey}
              fetchPage={(page) => getWithdrawals(page)}
              selectItems={(res) => res.withdrawals}
              itemKey={(w) => w.id}
              renderItem={(w) => <WithdrawalRow withdrawal={w} />}
              renderEmpty={() => (
                <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
                  <p className="text-base font-medium text-ink-900">
                    No withdrawals yet
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your payout requests will show up here.
                  </p>
                </div>
              )}
              skeleton={<WithdrawalRowSkeleton />}
              skeletonCount={3}
            />
          </div>
        </>
      )}
    </section>
  );
}

function ReasonState({ eligibility }: { eligibility: WithdrawEligibility }) {
  const message = eligibility.reason
    ? gateMessage(eligibility.reason, { min: eligibility.min_amount })
    : "Withdrawals aren't available right now.";

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
      <h2 className="font-sans text-lg font-semibold text-ink-900">
        Not just yet
      </h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
        {message}
      </p>
      {eligibility.reason === "kyc-not-verified" && (
        <Link
          href="/profile"
          className={buttonClassName({ fullWidth: true, className: "mt-5" })}
        >
          Set up payouts
        </Link>
      )}
    </div>
  );
}

function WithdrawalRowSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}
