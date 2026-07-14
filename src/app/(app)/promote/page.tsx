"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { buttonClassName } from "@/components/ui/button";
import { ArtifactCard } from "@/components/promote/artifact-card";
import { TemplateCard } from "@/components/promote/template-card";
import { renderPoster, renderStatusImage } from "@/lib/marketing/render";
import { MARKETING_TEMPLATES, inviteText } from "@/lib/marketing/templates";

const STATUS_CAPTION =
  MARKETING_TEMPLATES.find((t) => t.id === "status-caption") ?? null;

export default function PromotePage() {
  const agent = useAuthStore((s) => s.agent);
  const code = agent?.referral_code ?? null;
  const firstName = (agent?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  if (!code) {
    return (
      <section className="fade-up">
        <h1 className="font-sans text-xl font-semibold text-ink-900">
          Your marketing kit
        </h1>

        <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-canvas-sunken/60 p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-ink-200 text-ink-500">
            <Lock className="size-6" aria-hidden />
          </span>
          <p className="mt-4 text-base font-medium text-ink-900">
            Locked for now
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pass your certification quiz to unlock your marketing kit: posters,
            a status image, and ready-to-send messages built from your code.
          </p>
          <Link
            href="/quiz"
            className={buttonClassName({
              fullWidth: true,
              className: "mt-5",
            })}
          >
            Go to the quiz
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="fade-up">
      <h1 className="font-sans text-xl font-semibold text-ink-900">
        Your marketing kit
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share these anywhere. Everything already has your code.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <ArtifactCard
          title="Print poster"
          description="A5 poster for shops, notice boards, and business centres."
          code={code}
          firstName={firstName}
          render={renderPoster}
          filename={`biteexpress-poster-${code}.png`}
          width={1748}
          height={2480}
          previewAlt="BiteExpress referral poster."
          shareText={inviteText(code)}
          frameClassName="bg-canvas-sunken"
        />
        <ArtifactCard
          title="WhatsApp status"
          description="A dark, phone-sized image for your status or story."
          code={code}
          firstName={firstName}
          render={renderStatusImage}
          filename={`biteexpress-status-${code}.png`}
          width={1080}
          height={1920}
          previewAlt="BiteExpress WhatsApp status image."
          shareText={STATUS_CAPTION ? STATUS_CAPTION.body(code) : undefined}
          frameClassName="bg-canvas-dark"
        />
      </div>

      <h2 className="mt-8 font-sans text-lg font-semibold text-ink-900">
        Ready-to-send messages
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Copy any message, or send it straight to WhatsApp.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {MARKETING_TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} code={code} />
        ))}
      </div>
    </section>
  );
}
