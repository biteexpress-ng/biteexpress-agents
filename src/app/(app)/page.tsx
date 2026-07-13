"use client";

import { useAuthStore } from "@/stores/auth";
import { ReferralCodeCard } from "@/components/home/referral-code-card";

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
        <ReferralCodeCard code={agent.referral_code} className="mt-6" />
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-base text-ink-800">
            Your referral code is being set up. Check back in a moment.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h2 className="font-sans text-base font-semibold text-ink-900">
          What&apos;s next
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Customer tracking and earnings are coming soon. Every signup with your
          code already counts — keep sharing it.
        </p>
      </div>
    </section>
  );
}
