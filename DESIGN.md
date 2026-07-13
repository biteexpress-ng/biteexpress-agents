# Design

Visual system for agents.bite.express. This is a **port, not an invention**: the
source of truth is `biteexpress-web-app/src/app/globals.css` ("Premium Customer
Web App" theme). Copy that token block wholesale into this project's globals.css
and extend it only where the agent domain needs it. Do not hard-code hex values in
components; use the semantic tokens.

## Theme

Light-first (field use in daylight): canvas `#fafaf7` (warm paper), elevated
surfaces `#ffffff`, ink scale `#0d0d0f → #fafafa`. Dark surfaces (`#0a0a0a`,
`#050505`) are reserved for hero/emphasis moments — in this app that is the
certification-pass moment and the referral-code card, nothing else.

## Color

Inherited tokens (Tailwind v4 `@theme`, names must match biteexpress-web-app):

- Brand: `--color-brand-red: #de1600` (primary actions, active nav, progress),
  ramp red-400/500/600/700/950; `--color-brand-orange: #ff6b4a` (accent, sparingly);
  `--color-brand-black: #050505`.
- Neon variants (`--color-neon-red #ff2a14` etc.): glow/highlight only, never a
  surface.
- Ink neutrals: `--color-ink-0 … --color-ink-1000` (12-step zinc-ish scale).
- Canvas: `--color-canvas #fafaf7`, `-elevated #ffffff`, `-sunken #f3f2ee`,
  `-dark #0a0a0a`, `-darker #050505`.
- Semantic: success `#10b981`/soft `#ecfdf5`, warning `#f59e0b`/`#fffbeb`,
  error `#dc2626`/`#fef2f2`, info `#2563eb`.
- Aliases: background/foreground/muted/surface/border/primary/accent — keep the
  same mapping as the web app.

Color strategy: **Restrained** (product register). Brand red carries primary
buttons, active states, and progress; everything else is ink on canvas. Money
amounts render in `--color-ink-900` (or success green only for credited events),
never in red — red means action here, not debit.

## Typography

- Sans (everything): DM Sans via `next/font` → `--font-dm-sans`, fallback Inter,
  system-ui. UI labels, body, buttons, data.
- Serif (display, rare): DM Serif Display → `--font-dm-serif-display`. Reserved
  for the certification congratulations headline and the home greeting only.
- Mono: system mono stack for referral codes and OTP digits (`--font-mono`).
- Scale (fixed rem, ratio ≈1.2): 12 / 14 / 16 (base) / 18 / 20 / 24 / 30 / 36.
  Body 16px minimum. Line-height 1.5 body, 1.2 headings.
- Numbers: `font-variant-numeric: tabular-nums` on all amounts, counts, timers.

## Components

Match app.bite.express affordances:

- Buttons: pill or rounded-xl, brand red fill for the single primary action per
  screen; secondary = ink-900 text on canvas with border; 48px min height;
  pressed state scales 0.98 + darkens (red-600).
- Inputs: 48px min height, visible labels above (never placeholder-only), rounded
  borders `--color-border`, focus ring brand red at 2px, errors below the field in
  `--color-error` with plain-language recovery text.
- Cards: white elevated surface, radius ~16px, soft shadow; **no side-stripe
  accents, no nested cards**.
- The referral-code card is the signature element: dark surface
  (`--color-canvas-dark`), code in mono at display size, one-tap WhatsApp share as
  the primary action. This is the one place the dark+neon identity shows.
- Progress: thin brand-red bar for training progress; step dots for the quiz.
- Skeletons (not spinners) for loading lists; empty states teach ("No customers
  yet — share your code to get your first one").

## Layout

Mobile-first, single column, max-w-md centered on larger screens (this is a
phone tool; desktop is a courtesy). Bottom navigation (max 5 items) for the
certified app: Home, Training, Customers (Phase B), Earnings (Phase B), Profile.
Pre-certification: no bottom nav — a focused, linear flow. Respect safe areas
(`env(safe-area-inset-*)`); min-h-dvh, never 100vh. Spacing on a 4/8px rhythm.

## Motion

Product register: 150–250ms, ease-out, state-conveying only. Quiz step
transitions slide forward (translate + fade). The single orchestrated moment:
certification pass — code card reveal with a scale+fade and one glow pulse
(neon token), fully replaced by a crossfade under `prefers-reduced-motion`.
No page-load choreography anywhere else.

## Assets

`branding_materials/`: logo SVG + PNG (light/dark bg variants), favicon
(ico/png). Use the light-bg logo on canvas, dark-bg variant on the code card and
auth hero. App icons for the PWA manifest derive from the favicon PNG.
