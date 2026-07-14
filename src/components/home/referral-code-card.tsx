"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { inviteText } from "@/lib/marketing/templates";

interface ReferralCodeCardProps {
  code: string;
  className?: string;
  /** Screen-reader label for the region (defaults to a generic one). */
  ariaLabel?: string;
}

/**
 * The signature element: the one place the dark + neon brand identity shows.
 * Dark surface, code in mono at display size, one-tap WhatsApp share as the
 * primary action, with copy-to-clipboard as the quiet secondary.
 */
export function ReferralCodeCard({
  code,
  className,
  ariaLabel = "Your referral code",
}: ReferralCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const waHref = `https://wa.me/?text=${encodeURIComponent(inviteText(code))}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permission) — silently skip;
      // the code is visible and shareable via WhatsApp regardless.
    }
  }

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "overflow-hidden rounded-2xl bg-canvas-dark p-6 text-on-dark shadow-luxe",
        className,
      )}
    >
      <Logo variant="dark" height={22} />
      <p className="mt-5 text-sm text-ink-400">Your referral code</p>
      <p className="mt-1 break-all font-mono text-4xl font-semibold tracking-[0.12em] text-ink-0 tabular-nums">
        {code}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-base font-semibold text-primary-foreground shadow-soft transition-[transform,background-color,filter] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red active:scale-[0.98]"
        >
          <Share2 className="size-5" aria-hidden />
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-base font-medium text-ink-0 transition-colors duration-150 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-0 active:scale-[0.98]"
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check className="size-5" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-5" aria-hidden />
              Copy code
            </>
          )}
        </button>
      </div>
    </section>
  );
}
