"use client";

import { useEffect, useState } from "react";
import { getCustomers, markCustomerContacted } from "@/lib/api/agent";
import type { ReferredCustomer } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { AttentionRow } from "./attention-row";

/**
 * The needs-a-visit worklist: customers who signed up but never ordered, then
 * customers who went quiet. Renders nothing at all while loading, on error, on
 * an old backend without the filter, or when nobody needs a visit; the plain
 * customer list below always stands on its own. No congratulatory empty state,
 * this is a calm worklist, not a gamified surface.
 *
 * Mark contacted is optimistic: the row leaves immediately and comes back
 * silently if the API call fails (the app has no toast idiom to announce it).
 */
export function AttentionSection({ className }: { className?: string }) {
  const agent = useAuthStore((s) => s.agent);
  const [rows, setRows] = useState<ReferredCustomer[]>([]);
  const [markingId, setMarkingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getCustomers(1, "attention")
      .then((res) => {
        if (!active) return;
        // Old backend: no attention annotation, section stays absent.
        setRows(res.customers.filter((c) => c.attention != null));
      })
      .catch(() => {
        // Silent: the worklist is a courtesy, never blocks the customer list.
      });
    return () => {
      active = false;
    };
  }, []);

  const code = agent?.referral_code;
  if (!code || rows.length === 0) return null;

  const neverOrdered = rows.filter((c) => c.attention === "never_ordered");
  const quiet = rows.filter((c) => c.attention === "quiet");

  function markContacted(customer: ReferredCustomer) {
    setMarkingId(customer.id);
    const before = rows;
    setRows((cur) => cur.filter((c) => c.id !== customer.id));
    markCustomerContacted(customer.id)
      .catch(() => {
        // Bring the row back; the tap just didn't stick this time.
        setRows(before);
      })
      .finally(() => setMarkingId(null));
  }

  return (
    <section aria-label="Customers who need a visit" className={className}>
      <h2 className="text-base font-semibold text-ink-900">Needs a visit</h2>

      {neverOrdered.length > 0 && (
        <AttentionGroup label="Signed up, no orders yet" className="mt-3">
          {neverOrdered.map((customer) => (
            <AttentionRow
              key={customer.id}
              customer={customer}
              code={code}
              onMarkContacted={markContacted}
              marking={markingId === customer.id}
            />
          ))}
        </AttentionGroup>
      )}

      {quiet.length > 0 && (
        <AttentionGroup label="Gone quiet" className="mt-4">
          {quiet.map((customer) => (
            <AttentionRow
              key={customer.id}
              customer={customer}
              code={code}
              onMarkContacted={markContacted}
              marking={markingId === customer.id}
            />
          ))}
        </AttentionGroup>
      )}
    </section>
  );
}

function AttentionGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </div>
  );
}
