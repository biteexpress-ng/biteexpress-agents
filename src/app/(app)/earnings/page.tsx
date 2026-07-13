"use client";

import { getEarnings } from "@/lib/api/agent";
import type { EarningsResponse, LedgerEntry } from "@/lib/api/types";
import { PaginatedList } from "@/components/ui/paginated-list";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceHeader } from "@/components/earnings/balance-header";
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
