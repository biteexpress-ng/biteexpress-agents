"use client";

import { useState } from "react";
import Link from "next/link";
import type { EarningsProjection } from "@/lib/api/types";

/**
 * Estimates round to whole naira: false precision ("about ₦12,406.13") reads
 * as a promise, and the projector must always read as an estimate.
 */
function formatEstimate(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * The what-if projector. Three data modes, never mixed and never invented:
 *  (a) enough real history: project from the agent's own last 30 days;
 *  (b) too little history but finance has set an illustrative average:
 *      project from that, clearly labelled;
 *  (c) neither: an encouraging empty state, no numbers at all.
 */
export function ProjectorCard({
  projection,
}: {
  projection: EarningsProjection;
}) {
  const { active_customers: active, order_commission_30d: commission } =
    projection;
  const hasOwnData = active >= 3 && commission > 0;
  const illustrative = projection.illustrative_avg_monthly_per_active;

  const perActive = hasOwnData
    ? commission / active
    : illustrative > 0
      ? illustrative
      : null;

  if (perActive === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
        <p className="text-base font-medium text-ink-900">
          Your income projection
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up your first customers and this becomes your income projection.
        </p>
        <Link
          href="/promote"
          className="mt-3 inline-block text-sm font-medium text-brand-red"
        >
          Start promoting
        </Link>
      </div>
    );
  }

  return (
    <Projector
      mode={hasOwnData ? "own" : "illustrative"}
      active={active}
      commission={commission}
      perActive={perActive}
    />
  );
}

function Projector({
  mode,
  active,
  commission,
  perActive,
}: {
  mode: "own" | "illustrative";
  active: number;
  commission: number;
  perActive: number;
}) {
  const max = Math.min(100, Math.max(10, active * 2));
  const [count, setCount] = useState(() =>
    Math.min(max, Math.max(1, mode === "own" ? active : 5)),
  );
  const estimate = perActive * count;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      {mode === "own" ? (
        <p className="text-base text-ink-900">
          Your{" "}
          <span className="font-semibold tabular-nums">{active}</span> active{" "}
          {active === 1 ? "customer" : "customers"} earned you about{" "}
          <span className="font-semibold tabular-nums">
            {formatEstimate(commission)}
          </span>{" "}
          this month.
        </p>
      ) : (
        <p className="text-base text-ink-900">
          An active customer is worth about{" "}
          <span className="font-semibold tabular-nums">
            {formatEstimate(perActive)}
          </span>{" "}
          a month, based on a typical BiteExpress agent.
        </p>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="projector-count"
            className="text-sm font-medium text-ink-800"
          >
            If you had{" "}
            <span className="tabular-nums">{count}</span> active{" "}
            {count === 1 ? "customer" : "customers"}
          </label>
        </div>
        <input
          id="projector-count"
          type="range"
          min={1}
          max={max}
          step={1}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          aria-valuetext={`${count} active customers, about ${formatEstimate(estimate)} a month`}
          className="mt-2 h-11 w-full cursor-pointer accent-brand-red"
        />
        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
          about {formatEstimate(estimate)}
          <span className="text-base font-normal text-muted-foreground">
            /month
          </span>
        </p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {mode === "own"
          ? "Estimate from your last 30 days. Commissions come from delivered orders."
          : "Illustrative estimate, not a promise. Commissions come from delivered orders."}
      </p>
    </div>
  );
}
