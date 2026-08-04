import type { ReferredCustomer } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { Amount } from "@/components/ui/amount";

export function CustomerRow({ customer }: { customer: ReferredCustomer }) {
  const activated = customer.status === "activated";
  const channelLabel =
    customer.signup_channel === "assisted" ? "You signed up" : "Used your code";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-soft">
      <div className="min-w-0">
        <p className="truncate text-base font-medium text-ink-900">
          {customer.name_masked}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {formatDate(customer.joined_at)} · {channelLabel}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {activated ? (
          <>
            <Amount
              value={customer.commission_total}
              className="text-sm font-semibold"
            />
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {customer.orders_count}{" "}
              {customer.orders_count === 1 ? "order" : "orders"}
            </p>
          </>
        ) : (
          <span className="text-sm text-ink-500">No order yet</span>
        )}
      </div>
    </div>
  );
}
