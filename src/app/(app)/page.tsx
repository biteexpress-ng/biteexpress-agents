"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Megaphone, Wallet } from "lucide-react";
import { getCustomers, getEarnings } from "@/lib/api/agent";
import { useAuthStore } from "@/stores/auth";
import { formatNaira } from "@/lib/format";
import { ReferralCodeCard } from "@/components/home/referral-code-card";
import { ChallengeStrip } from "@/components/challenges/challenge-strip";
import { Skeleton } from "@/components/ui/skeleton";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const agent = useAuthStore((s) => s.agent);
  const firstName = (agent?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = greetingFor(new Date().getHours());

  return (
    <section className="fade-up">
      {/* Second and last serif display moment in the app. */}
      <h1 className="text-balance font-serif text-3xl leading-tight text-ink-900">
        {greeting}
        {firstName ? `, ${firstName}` : ""}
      </h1>

      {agent?.referral_code ? (
        <>
          <ReferralCodeCard code={agent.referral_code} className="mt-6" />
          <Link
            href="/promote"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft transition-colors hover:bg-canvas-sunken/50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-red/10 text-brand-red">
              <Megaphone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-ink-900">Promote</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Posters and messages, ready to share.
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
          </Link>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-base text-ink-800">
            Your referral code is being set up. Check back in a moment.
          </p>
        </div>
      )}

      <HomeNumbers />
      <ChallengeStrip className="mt-3" />
    </section>
  );
}

function HomeNumbers() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [withdrawable, setWithdrawable] = useState(0);
  const [pending, setPending] = useState(0);
  const [kycStatus, setKycStatus] = useState<string>("incomplete");
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getEarnings(1), getCustomers(1)])
      .then(([earnings, customers]) => {
        if (!active) return;
        setWithdrawable(earnings.balances.withdrawable);
        setPending(earnings.balances.pending);
        setKycStatus(earnings.eligibility.kyc_status);
        setCustomerCount(customers.stats.total);
        setState("ready");
      })
      .catch(() => {
        // Quiet: the home numbers are a bonus; a failure must never block the
        // referral-code card, which is the point of this screen.
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === "error") return null;

  const ready = state === "ready";
  const balanceHint =
    ready && pending > 0
      ? `${formatNaira(pending)} on its way to your bank.`
      : ready && withdrawable === 0
        ? "Your first commission lands when a customer's order is delivered."
        : undefined;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <NumberCard
        href="/earnings"
        label="Available balance"
        loading={state === "loading"}
        value={formatNaira(withdrawable)}
        hint={balanceHint}
      />
      <NumberCard
        href="/customers"
        label="Customers"
        loading={state === "loading"}
        value={String(customerCount)}
        hint={
          ready && customerCount === 0
            ? "Sign up your first one, or share your code."
            : undefined
        }
      />

      {ready && kycStatus === "incomplete" && withdrawable > 0 && (
        <Link
          href="/profile"
          className="flex items-start gap-3 rounded-2xl border border-brand-red/30 bg-[color-mix(in_srgb,var(--color-brand-red)_5%,#ffffff)] p-4 shadow-soft transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand-red)_8%,#ffffff)]"
        >
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-red/10 text-brand-red">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-medium text-ink-900">
              Set up payouts to withdraw
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You&apos;ve earned money — add your details to cash it out.
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}

function NumberCard({
  href,
  label,
  loading,
  value,
  hint,
}: {
  href: string;
  label: string;
  loading: boolean;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft transition-colors hover:bg-canvas-sunken/50"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1.5 h-8 w-28" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
            {value}
          </p>
        )}
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
    </Link>
  );
}
