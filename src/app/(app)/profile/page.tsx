"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { logout } from "@/lib/api/agent";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KycCard } from "@/components/kyc/kyc-card";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="break-all text-right text-base font-medium text-ink-900">
        {value}
      </dd>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const clear = useAuthStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      await logout();
    } catch {
      // Clear locally regardless.
    }
    clear();
    router.replace("/login");
  }

  if (!agent) return null;

  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">Profile</h1>

      <dl className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
        <Row label="Name" value={agent.full_name} />
        <Row label="Email" value={agent.email} />
        <Row label="Phone" value={agent.phone} />
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd>
            {agent.certified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-sm font-medium text-[color:var(--color-success-strong)]">
                <BadgeCheck className="size-4" aria-hidden />
                Certified
              </span>
            ) : (
              <span className="text-base font-medium capitalize text-ink-900">
                {agent.status}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <KycCard />
      </div>

      <Button
        variant="secondary"
        fullWidth
        className="mt-6"
        onClick={() => setOpen(true)}
      >
        Log out
      </Button>

      <ConfirmDialog
        open={open}
        title="Log out?"
        description="You'll need to sign in again to see your dashboard."
        confirmLabel="Log out"
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
        loading={loading}
      />
    </section>
  );
}
