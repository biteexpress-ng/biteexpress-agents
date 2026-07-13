"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { getChallenge, getCustomers } from "@/lib/api/agent";
import type { CustomerList, ReferredCustomer } from "@/lib/api/types";
import { buttonClassName } from "@/components/ui/button";
import { PaginatedList } from "@/components/ui/paginated-list";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerRow } from "@/components/customers/customer-row";

export default function CustomersPage() {
  // When the challenge is active, surface this week's signup count next to the
  // customer totals — one screen from the signup CTA. Off/failed → simply absent.
  const [weeklySignups, setWeeklySignups] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getChallenge()
      .then((c) => {
        if (active && c.active && c.current) setWeeklySignups(c.current.signups);
      })
      .catch(() => {
        // Silent: the weekly stat is a courtesy, never blocks the customer list.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">Customers</h1>

      {/* Persistent primary action — this is the screen agents keep open in the
          field, so the CTA stays visible through loading and error states. */}
      <Link
        href="/signup-customer"
        className={buttonClassName({ fullWidth: true, className: "mt-4" })}
      >
        <UserPlus className="size-5" aria-hidden />
        Sign up a customer
      </Link>

      <div className="mt-6">
        <PaginatedList<ReferredCustomer, CustomerList>
          fetchPage={(page) => getCustomers(page)}
          selectItems={(res) => res.customers}
          itemKey={(customer) => customer.id}
          renderHeader={(first) => (
            <p className="mb-4 text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-ink-900">
                {first.stats.total}
              </span>{" "}
              {first.stats.total === 1 ? "customer" : "customers"} ·{" "}
              <span className="font-medium tabular-nums text-ink-900">
                {first.stats.activated}
              </span>{" "}
              active
              {weeklySignups !== null && (
                <>
                  {" · "}
                  <span className="font-medium tabular-nums text-ink-900">
                    {weeklySignups}
                  </span>{" "}
                  this week
                </>
              )}
            </p>
          )}
          renderItem={(customer) => <CustomerRow customer={customer} />}
          renderEmpty={() => (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
              <p className="text-base font-medium text-ink-900">
                No customers yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign someone up on the spot, or share your code so they can join
                on their own.
              </p>
              <Link
                href="/"
                className={buttonClassName({
                  variant: "secondary",
                  fullWidth: true,
                  className: "mt-5",
                })}
              >
                Share your code
              </Link>
            </div>
          )}
          skeleton={<CustomerRowSkeleton />}
        />
      </div>
    </section>
  );
}

function CustomerRowSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
