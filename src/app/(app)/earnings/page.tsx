"use client";

import Link from "next/link";
import { getEarnings } from "@/lib/api/agent";
import type {
  EarningsResponse,
  LedgerEntry,
  WithdrawEligibility,
} from "@/lib/api/types";
import { gateMessage } from "@/lib/api/messages";
import { buttonClassName } from "@/components/ui/button";
import { PaginatedList } from "@/components/ui/paginated-list";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceHeader } from "@/components/earnings/balance-header";
import { LockedBonusCard } from "@/components/earnings/locked-bonus-card";
import { LedgerRow } from "@/components/earnings/ledger-row";

export default function EarningsPage() {
  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">Earnings</h1>

      <div className="mt-6">
        <PaginatedList<LedgerEntry, EarningsResponse>
          fetchPage={(page) => getEarnings(page)}
          selectItems={(res) => res.ledger}
          itemKey={(entry) => entry.id}
          renderHeader={(first) => (
            <div className="mb-8">
              <BalanceHeader balances={first.balances} />
              {first.locked_bonus && (
                <div className="mt-5">
                  <LockedBonusCard bonus={first.locked_bonus} />
                </div>
              )}
              <div className="mt-6">
                <WithdrawCta eligibility={first.eligibility} />
              </div>
            </div>
          )}
          renderItem={(entry) => <LedgerRow entry={entry} />}
          renderEmpty={() => (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
              <p className="text-base font-medium text-ink-900">No earnings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Commissions land here when a customer you signed up gets an order
                delivered.
              </p>
            </div>
          )}
          skeleton={<LedgerRowSkeleton />}
        />
      </div>
    </section>
  );
}

/**
 * The withdraw CTA never disappears: when blocked, it shows a disabled button
 * plus the plain reason from the shared copy map, and a route to fix it.
 */
function WithdrawCta({ eligibility }: { eligibility: WithdrawEligibility }) {
  if (eligibility.can_withdraw) {
    return (
      <Link href="/withdraw" className={buttonClassName({ fullWidth: true })}>
        Withdraw
      </Link>
    );
  }

  const message = eligibility.reason
    ? gateMessage(eligibility.reason, { min: eligibility.min_amount })
    : "Withdrawals aren't available right now.";

  return (
    <div>
      <button
        type="button"
        disabled
        className={buttonClassName({
          fullWidth: true,
          className: "pointer-events-none opacity-50",
        })}
      >
        Withdraw
      </button>
      <p className="mt-2 text-center text-sm text-muted-foreground">{message}</p>
      {eligibility.reason === "kyc-not-verified" && (
        <Link
          href="/profile"
          className="mt-1 block text-center text-sm font-medium text-brand-red"
        >
          Set up payouts
        </Link>
      )}
    </div>
  );
}

function LedgerRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-2 h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
