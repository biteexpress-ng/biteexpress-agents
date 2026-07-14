# Agent Program Phase E1 (PWA) Implementation Plan — Marketing Kit

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. Read `PRODUCT.md` and `DESIGN.md` first; load `frontend-design`, `impeccable`, and `ui-ux-pro-max` if available. The established quality floor binds verbatim.

**Goal:** Arm agents with ready-to-use distribution material generated from their own referral code, entirely in the PWA: a printable QR poster, a WhatsApp status image, and a set of pre-written share messages. An agent should go from opening the app to having a poster saved on their phone in under a minute.

**Architecture:** Pure client-side phase — **zero backend changes, zero new API endpoints**. Everything derives from the already-loaded agent profile (`referral_code`, first name). One new route `/promote`, entered from a home card and from the customers screen; the bottom nav stays at five. Poster and status images are rendered on a `<canvas>` in the browser and downloaded or shared via the Web Share API. QR generation via the `qrcode` npm package (offline, no network calls).

**Tech Stack:** unchanged, plus the `qrcode` package (and its types). No other new dependencies.

## Global Constraints

- **Repo:** `C:\laragon\www\biteexpress-agents`.
- **No em-dashes anywhere in customer-facing template copy or on rendered images.** Use commas, colons, or periods. This is a hard brand rule.
- **Honest copy only.** Templates must never invent discounts, promos, or claims ("50% off today!") that the platform is not running. Generic value language only: fast delivery, real restaurants, groceries, pay on delivery where true.
- Nigerian-English register: warm, direct, street-smart, never corporate. Templates are things a real person would actually post, not ad copy.
- Only certified agents have a `referral_code`. `/promote` with a null code shows a calm locked state pointing to `/quiz` ("Pass your certification quiz to unlock your marketing kit"), consistent with existing gating patterns. Never a crash or blank screen.
- Agent's personal data on artifacts: **first name only** (e.g. "Your BiteExpress agent: Tunde"). Never phone number, never email, never full name.
- Verification: `npm run build` per task; final seeded live pass mandatory. Dev servers via `taskkill /F /T /PID` only.
- Commit per task; push at the end. Stop after Task 4.

## Frozen product decisions

- **QR target URL:** `https://bite.express/?ref={CODE}`. The `ref` param is inert on the marketing site today; it is forward-compatible for capture/analytics later (recorded as backlog). The code is therefore ALWAYS also printed on the artifact in large type with "use code {CODE} when you sign up" — the QR is a convenience, the printed code is the mechanism.
- **Artifacts (both rendered from one shared canvas renderer):**
  1. **Print poster** — A5 portrait at 300dpi (1748×2480 px), designed to still read when photocopied in black and white at a business centre: high contrast, code in huge type, QR with generous quiet zone.
  2. **WhatsApp status image** — 1080×1920 px, dark brand surface (the ReferralCodeCard identity), code as the hero, QR smaller, "DM me or use my code on bite.express".
- **Delivery:** primary action is Web Share API level 2 with the PNG file (`navigator.canShare({files})` guard) so the agent can post straight to WhatsApp status; fallback is a plain download link (`canvas.toBlob` → object URL). Both always visible: "Share" primary, "Download" secondary.
- **Templates:** exactly six, in one copy module so iteration is a one-file change:
  1. General invite (evolution of the existing `inviteText`, kept consistent with it)
  2. Food-craving hook (casual, for status captions)
  3. Groceries/essentials angle
  4. Follow-up nudge to someone who took the code but hasn't ordered
  5. Status caption to pair with the status image
  6. SMS-length variant (≤160 chars) for non-WhatsApp sharing
  Every template interpolates `{code}` and links `https://bite.express`. Each template card shows the full resolved preview, with Copy and "Share on WhatsApp" (`wa.me/?text=`) actions reusing the app's existing button idiom.

---

### Task 1: Copy module + template cards

**Files:**
- Create: `src/lib/marketing/templates.ts`, `src/components/promote/template-card.tsx`
- Modify: `src/components/home/referral-code-card.tsx` (move/export `inviteText` from the new module so there is ONE source of invite copy)

**Steps:**

- [ ] `templates.ts`: `interface MarketingTemplate { id, title, body(code: string): string, kind: 'whatsapp' | 'status-caption' | 'sms' }` + the six templates above. Copy rules from Global Constraints enforced here; add a unit-style dev assertion or comment block noting the no-em-dash and no-fake-promo rules at the top of the file.
- [ ] Refactor `referral-code-card.tsx` to import the general invite from `templates.ts` (behaviour unchanged).
- [ ] `TemplateCard`: title, resolved body in a quiet quoted block, Copy (clipboard + 2s "Copied" state, silent failure like the existing card) and Share on WhatsApp actions. Long bodies never overflow at 360px.
- [ ] Verify: `npm run build`. Commit: `feat: marketing template copy module and cards`.

### Task 2: Canvas renderer (poster + status image)

**Files:**
- Create: `src/lib/marketing/render.ts`, `src/components/promote/artifact-card.tsx`
- Add dependency: `qrcode` (+ `@types/qrcode` if needed)

**Steps:**

- [ ] `render.ts`: `renderPoster(code, firstName): Promise<Blob>` and `renderStatusImage(code, firstName): Promise<Blob>`. Await `document.fonts.ready` and use the app's font stack; draw the logo from `/public` brand assets (the repo's `branding_materials` has the source files — copy the needed logo PNG/SVG into `public/` if not already there); QR via `qrcode`'s `toCanvas`/`toDataURL` with error correction M and a proper quiet zone. Layout specs per Frozen product decisions. Amounts/claims: none — these artifacts carry no numbers except the code.
- [ ] `ArtifactCard`: live preview (scaled-down `<img>` from the rendered blob, regenerated when profile loads), primary Share button (Web Share with file, guarded by `navigator.canShare`), secondary Download button (object URL, sensible filename like `biteexpress-poster-{code}.png`). Rendering state = skeleton, render failure = quiet retry state, never a crash.
- [ ] Verify: `npm run build`; manually confirm both PNGs open crisp at full resolution. Commit: `feat: client-side poster and status image renderer`.

### Task 3: /promote route + entry points

**Files:**
- Create: `src/app/(app)/promote/page.tsx`
- Modify: `src/app/(app)/page.tsx`, `src/app/(app)/customers/page.tsx`

**Steps:**

- [ ] `/promote`: header ("Your marketing kit"), poster ArtifactCard, status-image ArtifactCard, then the six TemplateCards grouped under "Ready-to-send messages". Null `referral_code` → locked state linking to `/quiz` (see Global Constraints). Page works fully offline once loaded (no network needed to render).
- [ ] Home: a compact "Promote" entry card below the ReferralCodeCard ("Posters and messages, ready to share") linking to `/promote`; renders only when `referral_code` exists.
- [ ] Customers screen: the existing "share your code" guidance gains a link to `/promote`.
- [ ] Verify: `npm run build`. Commit: `feat: promote screen with marketing kit`.

### Task 4: Live pass + ship prep

**Steps:**

- [ ] Live pass (production build, seeded certified agent with a real code): home shows the Promote card; /promote renders both artifacts; Download yields correct-size PNGs (1748×2480 and 1080×1920) with scannable QRs (scan with a real phone — this is mandatory, a QR that renders but does not scan is a failed pass); every template's Copy and wa.me share works; uncertified seeded agent → locked state; deep link to /promote while logged out → auth guard behaves like other routes.
- [ ] Print check: poster PNG placed in a document and printed OR print-previewed at A5 — code legible, QR ≥ 3cm.
- [ ] A11y spot-pass: preview images have meaningful alt text including the code, buttons have accessible names, 360px no-overflow, template bodies readable at 200% zoom.
- [ ] Grep the diff for `—` (em-dash) in any template/artifact string: must be zero.
- [ ] README route list; `npm run build` green; push.
- [ ] Report for the CTO gate: screenshots of /promote + both artifacts at full size, live-pass results, QR scan confirmation, deviations.

---

## Out of scope

Referral capture on bite.express (`?ref=` handling — backlog), server-side artifact generation, PDF output, video/reel templates, per-agent custom photos on artifacts, analytics on template usage, admin-editable template copy (v1 ships copy in code; revisit if iteration demand is real).
