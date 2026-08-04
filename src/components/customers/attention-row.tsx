"use client";

import { MessageCircle } from "lucide-react";
import type { ReferredCustomer } from "@/lib/api/types";
import { MARKETING_TEMPLATES, inviteText } from "@/lib/marketing/templates";
import { buttonClassName, Button } from "@/components/ui/button";

/**
 * The E1 follow-up nudge is the one piece of copy this surface sends. It lives
 * in the marketing templates file (the single source of share copy); this is a
 * lookup, not a fork. inviteText is only the never-shipped fallback if the
 * template id is ever renamed.
 */
const followUpBody =
  MARKETING_TEMPLATES.find((t) => t.id === "follow-up")?.body ?? inviteText;

/**
 * Coarse, honest recency: weeks then months, never exact days. Precision would
 * imply surveillance; the agent only needs "how long, roughly".
 */
export function coarseAgo(iso: string): string | null {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 7) return "this week";
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

function contextLine(customer: ReferredCustomer): string {
  if (customer.attention === "never_ordered") {
    const ago = coarseAgo(customer.joined_at);
    return ago && ago !== "this week"
      ? `Joined ${ago}, no orders yet`
      : "Joined this week, no orders yet";
  }
  const ago = customer.last_order_at ? coarseAgo(customer.last_order_at) : null;
  return ago ? `Last order ${ago}` : "No recent orders";
}

interface AttentionRowProps {
  customer: ReferredCustomer;
  /** The agent's referral code, resolved into the follow-up template. */
  code: string;
  /** Optimistic: the section removes the row and reverts on API failure. */
  onMarkContacted: (customer: ReferredCustomer) => void;
  marking: boolean;
}

/**
 * One quiet customer, one honest context line, two ways to act. WhatsApp opens
 * the share sheet (wa.me with no number: the agent picks the chat; we never
 * hold the customer's phone). Mark contacted hides them for the cooldown.
 */
export function AttentionRow({
  customer,
  code,
  onMarkContacted,
  marking,
}: AttentionRowProps) {
  const waHref = `https://wa.me/?text=${encodeURIComponent(followUpBody(code))}`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <p className="truncate text-base font-medium text-ink-900">
        {customer.name_masked}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {contextLine(customer)}
      </p>

      <div className="mt-3 flex gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({
            variant: "secondary",
            className: "min-h-11 flex-1 px-3 text-sm",
          })}
          aria-label={`Send ${customer.name_masked} a WhatsApp follow-up`}
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <Button
          variant="ghost"
          loading={marking}
          onClick={() => onMarkContacted(customer)}
          className="min-h-11 flex-1 px-3 text-sm font-medium text-ink-600"
          aria-label={`Mark ${customer.name_masked} as contacted`}
        >
          Mark contacted
        </Button>
      </div>
    </div>
  );
}
