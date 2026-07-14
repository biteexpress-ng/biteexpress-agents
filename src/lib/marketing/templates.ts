/**
 * Marketing copy templates for the agent kit.
 *
 * This is the ONE source of share/invite copy in the app. The home
 * ReferralCodeCard imports `inviteText` from here; the /promote screen renders
 * all six templates. Iterating copy is a one-file change.
 *
 * Copy rules (hard brand constraints, enforced by the dev assertion at the
 * bottom of this file):
 *  1. No em-dashes anywhere. Use commas, colons, or periods. (Em-dashes read as
 *     "AI copy" and are a brand no.)
 *  2. Honest copy only. Never invent a discount, promo, or claim the platform is
 *     not running ("50% off today!"). Generic value language only: fast
 *     delivery, real restaurants, groceries, everyday essentials.
 *  3. Nigerian-English register: warm, direct, a real person would post it. Not
 *     ad copy, not corporate.
 *  4. Every body interpolates {code} and links https://bite.express.
 */

/** The marketing site. The `?ref=` capture is backlog; the printed code is the
 *  mechanism, so the plain URL is what we link in text templates. */
export const SITE_URL = "https://bite.express";

export type TemplateKind = "whatsapp" | "status-caption" | "sms";

export interface MarketingTemplate {
  id: string;
  /** Short human label shown on the template card. */
  title: string;
  /** Where this copy is meant to be posted; drives grouping/labelling. */
  kind: TemplateKind;
  /** Resolve the full copy for a given referral code. */
  body(code: string): string;
}

/**
 * The general invite. Kept as its own export because the ReferralCodeCard's
 * one-tap WhatsApp share uses exactly this line, and it must stay the single
 * source of that copy.
 */
export function inviteText(code: string): string {
  return `I'm inviting you to BiteExpress. Order food, groceries and more, delivered fast. Use my code ${code} when you sign up: ${SITE_URL}`;
}

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    id: "general-invite",
    title: "General invite",
    kind: "whatsapp",
    body: inviteText,
  },
  {
    id: "food-craving",
    title: "Food craving",
    kind: "status-caption",
    body: (code) =>
      `Hungry? Real restaurants near you, delivered straight to your door. Order on BiteExpress with code ${code}: ${SITE_URL}`,
  },
  {
    id: "groceries",
    title: "Groceries and essentials",
    kind: "whatsapp",
    body: (code) =>
      `Groceries and everyday essentials, brought to your door so you don't have to go out. Join BiteExpress with my code ${code}: ${SITE_URL}`,
  },
  {
    id: "follow-up",
    title: "Follow-up nudge",
    kind: "whatsapp",
    body: (code) =>
      `You still have my BiteExpress code ${code}. Whenever you're ready, place your first order and food or groceries come straight to you: ${SITE_URL}`,
  },
  {
    id: "status-caption",
    title: "Status caption",
    kind: "status-caption",
    body: (code) =>
      `Order food and groceries on BiteExpress. Scan my code, or use ${code} to sign up. ${SITE_URL}`,
  },
  {
    id: "sms",
    title: "Short message (SMS)",
    kind: "sms",
    body: (code) =>
      `Join BiteExpress for fast food and grocery delivery. Use code ${code} at signup: ${SITE_URL}`,
  },
];

/* ---------------------------------------------------------------------------
 * Dev-time copy guard. Runs once on module load outside production so a copy
 * edit that breaks a brand rule is caught immediately, not in a live review.
 * ------------------------------------------------------------------------- */
if (process.env.NODE_ENV !== "production") {
  const SAMPLE_CODE = "BX7QK2"; // representative resolved length for the checks
  const SMS_LIMIT = 160;

  for (const t of MARKETING_TEMPLATES) {
    const resolved = t.body(SAMPLE_CODE);

    if (resolved.includes("—")) {
      throw new Error(
        `Marketing template "${t.id}" contains an em-dash. Brand rule: no em-dashes in share copy.`,
      );
    }
    if (!resolved.includes(SAMPLE_CODE)) {
      throw new Error(
        `Marketing template "${t.id}" does not interpolate the referral code.`,
      );
    }
    if (!resolved.includes(SITE_URL)) {
      throw new Error(
        `Marketing template "${t.id}" is missing the ${SITE_URL} link.`,
      );
    }
    if (t.kind === "sms" && resolved.length > SMS_LIMIT) {
      throw new Error(
        `Marketing template "${t.id}" is ${resolved.length} chars; SMS variants must be <= ${SMS_LIMIT}.`,
      );
    }
  }
}
