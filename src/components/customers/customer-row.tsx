import type { ReferredCustomer } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { Amount } from "@/components/ui/amount";

export function CustomerRow({ customer }: { customer: ReferredCustomer }) {
  const activated = customer.status === "activated";
  const channelLabel =
    customer.signup_channel === "assisted" ? "You signed up" : "Used your code";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-ink-900">
            {customer.name_masked}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Joined {formatDate(customer.joined_at)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-canvas-sunken px-2.5 py-1 text-xs font-medium text-ink-600">
          {channelLabel}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        {activated ? (
          <>
            <span className="text-sm text-muted-foreground tabular-nums">
              {customer.orders_count}{" "}
              {customer.orders_count === 1 ? "order" : "orders"}
            </span>
            <Amount
              value={customer.commission_total}
              className="text-base font-semibold"
            />
          </>
        ) : (
          <span className="text-sm text-ink-500">
            No order yet — it counts when they order
          </span>
        )}
      </div>
    </div>
  );
}
