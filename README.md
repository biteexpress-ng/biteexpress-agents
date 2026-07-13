# BiteExpress Agents (agents.bite.express)

The working tool of the BiteExpress Agent Program: a mobile-first, installable
PWA that certifies field agents (training videos + quiz), gives them their
referral code, and — in later phases — tracks customers, commission, and
payouts.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
zustand, and react-hook-form + zod. The visual system is ported from
`biteexpress-web-app` (see `DESIGN.md`) so this app is recognizably part of the
`bite.express` / `app.bite.express` family.

**Scope shipped (Phase A2 + B2 + C2):** login, password setup, training,
certification quiz, certified home (referral code + live balance/customer
numbers), **customers** (`/customers`), **earnings** (`/earnings` with the
eligibility-aware withdraw CTA), **assisted signup** (`/signup-customer`),
**KYC** (status-driven, on `/profile`), and **withdrawals** (`/withdraw` +
payout history). Challenges and notifications are Phase D.

## Requirements

- Node.js 20+
- The Phase A1 agent API (Laravel) reachable at `NEXT_PUBLIC_API_BASE_URL`.
  This app is a pure API consumer — it does not talk to a database directly.

## Setup

```bash
npm install
cp .env.example .env.local   # then edit if your API host differs
npm run dev                  # http://localhost:3000
```

### Environment

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://dashboard.bite.express.test` (local) · `https://dashboard.bite.express` (prod) | No trailing slash. All requests go to `${BASE}/api/v1/agent/*`. |

The app reads/writes the session (`{token, agent}`) to `localStorage` under
`bx-agent-auth`. Auth is a Bearer token on every authed request; a 401 clears
the session and returns the agent to `/login`.

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build (also the type/lint gate)
npm run start   # serve the production build
```

## Deploy

Target: **agents.bite.express** on Vercel, same as `biteexpress-web-app`.

1. Import this repo into a new Vercel project.
2. Set `NEXT_PUBLIC_API_BASE_URL=https://dashboard.bite.express` in Project
   Settings → Environment Variables (Production).
3. Add the `agents.bite.express` domain and point DNS at Vercel.

The app sets `robots: noindex` — it must not be indexed.

## Structure

```
src/
  app/
    (auth)/          login, setup-password (unguarded, no bottom nav)
    (app)/           home, training, quiz, customers, earnings,
                     withdraw, signup-customer, profile (KYC lives here),
                     (auth-guarded, gated)
    layout.tsx       fonts, metadata, favicon
    globals.css      ported @theme tokens + brand utilities
    manifest.ts      PWA manifest
  components/
    ui/              button, input, field, alert, dialog, skeleton, ...
    layout/          app-header, bottom-nav
    training/ quiz/ home/   feature components
  lib/api/           typed client + endpoint functions + types
  stores/auth.ts     zustand session store (persisted)
```

Certification gates the shell: until `agent.certified`, only `/training` and
`/quiz` are reachable and there is no bottom nav; passing the quiz unlocks the
full app.
