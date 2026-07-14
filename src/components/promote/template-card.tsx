"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import type { MarketingTemplate } from "@/lib/marketing/templates";

interface TemplateCardProps {
  template: MarketingTemplate;
  code: string;
}

/**
 * One ready-to-send message: title, the resolved copy in a quiet quoted block,
 * and two equal-weight actions (Copy, Share on WhatsApp). Kept calmer than the
 * poster/status Share buttons above it, so the primary action on the screen
 * stays with the artifacts.
 */
export function TemplateCard({ template, code }: TemplateCardProps) {
  const [copied, setCopied] = useState(false);
  const body = template.body(code);
  const waHref = `https://wa.me/?text=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permission): the copy is visible
      // and the WhatsApp action still works, so fail quietly like the code card.
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="text-sm font-semibold text-ink-900">{template.title}</h3>

      <p className="mt-3 break-words whitespace-pre-wrap rounded-xl bg-canvas-sunken px-4 py-3 text-[15px] leading-relaxed text-ink-800">
        {body}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copy}
          className={buttonClassName({ variant: "secondary" })}
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
              Copy
            </>
          )}
        </button>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: "secondary" })}
        >
          <Share2 className="size-5" aria-hidden />
          WhatsApp
        </a>
      </div>
    </article>
  );
}
