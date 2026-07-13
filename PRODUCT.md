# Product

## Register

product

## Users

BiteExpress field agents in Nigeria: trained, certified marketers who onboard
customers to earn lifetime per-order commission. They work on mid-range Android
phones over variable mobile data, often outdoors in bright light, mid-conversation
with a prospective customer. Many are first-time gig workers; some are students or
low-income earners supplementing other work. English literacy is functional but
the interface must never be academic.

Primary jobs, in order of frequency once certified:
1. Check earnings and this week's challenge progress (daily glance).
2. Sign up a customer on the spot (assisted OTP flow) or share their referral code.
3. Request a withdrawal.

Before certification, the entire product is one job: finish training videos, pass
the quiz, get the referral code.

## Product Purpose

The agent dashboard (agents.bite.express) is the working tool of the BiteExpress
Agent Program: it certifies agents through training + quiz, gives them their
referral code, tracks the customers they onboard and the commission each order
earns them, and pays them out. Success = an agent can go from approval email to
certified with a shareable code in one sitting on a phone, and thereafter trusts
the numbers on the home screen enough to build their weekly routine around them.

## Brand Personality

Premium, effortless, urban — the established BiteExpress identity ("Apple × Uber ×
DoorDash", see biteexpress-web-app). For agents specifically the tone tilts toward
**earned pride and momentum**: this is a professional tool that makes a grassroots
job feel like a career. Voice: plain verbs, sentence case, encouraging but never
patronizing. Numbers (earnings, progress) are the emotional core; treat them with
typographic respect (tabular figures, clear hierarchy).

## Anti-references

- Generic admin templates (Bootstrap dashboards, stat-card grids with icon+number).
- Crypto/HYIP earning-app aesthetics: coin animations, confetti overload, fake
  urgency, neon "EARN NOW" gradients. The one celebration moment allowed is
  passing certification.
- The 6amTech admin panel look. The agent PWA is a consumer-grade surface.
- Cream/beige "AI default" palettes — the brand canvas (#fafaf7) and token system
  are already committed; use them, don't reinvent.

## Design Principles

1. **Consistency with the family** — the PWA must be recognizably the same product
   as bite.express and app.bite.express: same tokens, same type pairing, same
   component vocabulary. Reuse before invention.
2. **One job per screen** — each screen has a single primary action; before
   certification the app IS the training flow, and nothing else competes.
3. **Numbers are the interface** — earnings, progress, and streaks are the content
   agents came for; design the numeric hierarchy first, chrome second.
4. **Built for the field** — big touch targets, readable in sunlight (never rely on
   low-contrast grays), tolerant of flaky networks (clear loading/retry states),
   installable and fast on low-end Android.
5. **Trustworthy money** — anything financial is calm, precise, and auditable in
   feel; no decoration near a naira amount.

## Accessibility & Inclusion

WCAG 2.1 AA: body contrast ≥4.5:1, touch targets ≥44px, visible focus states,
semantic inputs (tel/email keyboards), `prefers-reduced-motion` respected, base
font ≥16px. Assume older/low-end Android Chrome; no feature may depend on hover.
