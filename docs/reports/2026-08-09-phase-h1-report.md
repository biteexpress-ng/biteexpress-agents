# Phase H1 report: tiers + city leaderboards

Cross-repo phase, executed task-by-task against
`docs/plans/2026-08-04-phase-h1-tiers-leaderboards.md`. Both repos are pushed
and clean. Everything ships off: `agent_tiers` seeds `[]` and
`agent_leaderboard_enabled` seeds `0`, so production behaviour is unchanged
until an admin sets a ladder and flips the flag.

## Commits

### dashboard.bite.express (`main`, pushed, `7f94ad2..652c90b`)

| Commit | Task | Subject |
|---|---|---|
| `702d68d` | A1 | Add the agent tier engine and the admin tier editor |
| `843decb` | A2 | Raise the express ceiling by tier and announce a tier-up |
| `652c90b` | A3 | Add the city-scoped weekly leaderboard endpoint |

19 files, +1944 / -7. Production probe after deploy: `GET /api/v1/agent/leaderboard`
answers 401 (route present, auth-guarded) where an unknown agent route answers
404, so the migration and routes landed on srv02.

### biteexpress-agents (`main`, pushed, `4472445..4269401`)

| Commit | Task | Subject |
|---|---|---|
| `78e08cf` | B1 | feat: agent tier badges |
| `3924d2f` | B2 | feat: city leaderboard on challenges screen |
| `4269401` | B3 | fix: three leaderboard defects the seeded live pass found |

17 files, +672 / -49 (includes the phase plan itself, previously untracked).

## Tests

| Suite | Result |
|---|---|
| Full agent suite (`--filter Agent`), final run | 292 tests, 924 assertions, green |
| `AgentTierServiceTest` (new, A1) | 24 tests |
| `AgentTierPerkAndPushTest` (new, A2) | 14 tests |
| `AgentLeaderboardApiTest` (new, A3) | 21 tests |
| PWA `npm run build` after every task | green, TypeScript clean |

59 new tests. Baseline before H1 was 233; no existing test was modified.

The three new suites cover: config validation (descending storage read back
ascending, duplicate names and thresholds rejected whole, seventh tier
rejected, zero threshold rejected), `tierFor` boundaries (count equal to a
threshold is inside that tier), malformed JSON degrading to off, payload shape
with and without config, the express ceiling matrix (tier above global, tier
below global, tier absent, tiers off, zero global still closes the lane, KYC
and clean-payout rules still enforced), tier-up firing exactly on the threshold
and not on the next activation, below-floor activation with no commission row
still firing, a throwing push never breaking delivery or accrual, city
isolation, ranking with both tiebreaks, `is_you`, off-board rank, Lagos week
boundaries, flag-off shape, null-city shape, and the privacy shape asserted
field-by-field.

## Screenshots

In the session scratchpad at `.../scratchpad/screenshots/`:

| File | Shows |
|---|---|
| `h1-01-home-tier-and-city-card.png` | Bronze nameplate under the greeting, city card |
| `h1-02-profile-tier.png` | Tier chip in the profile header beside Certified |
| `h1-03-earnings-next-tier.png` | "3 more active customers to Silver." under the projector |
| `h1-04-leaderboard-only-lagos-onboard.png` | Board as h1 with challenges off, viewer on-board |
| `h1-05-leaderboard-zaria-offboard-pinned.png` | Top ten, pinned rank-14 row, Last week strip |
| `h1-06-challenge-plus-leaderboard.png` | Both sections on one screen |
| `h1-07-artifacts-no-tier.png` | Poster and status with no tier mark |
| `h1-08-artifacts-with-tier.png` | Same two artifacts carrying the mark |
| `h1-09-artifact-tier-mark-closeup.png` | "Bronze agent" under the agent line on both |
| `h1-10-leaderboard-empty-city.png` | Empty-board state |
| `h1-11-leaderboard-flag-off.png` | Flag off: challenge intact, board gone |
| `h1-12/13-leaderboard-360px*.png` | 360px, no horizontal overflow |

No screenshot of a delivered tier-up notification. See Deviations.

## Live pass

Local backend on `127.0.0.1:8000`, PWA production build on `127.0.0.1:3010`,
seeded with two cities plus a null-city agent, tiers Bronze 2 / Silver 5 with
Silver carrying a raised express ceiling, global express cap 20,000.

| Check | Result |
|---|---|
| Tier badge on profile and home | Bronze nameplate on both |
| Tier line near the projector | "3 more active customers to Silver." |
| Tier mark on poster and status | Present, small, under the agent line |
| Absent-tier artifacts unchanged | See below |
| Board ranks, `is_you`, Last week | Correct in both cities |
| **City isolation, two viewer accounts** | Zaria viewer sees Ada/Bala/Chidi/Rivals; Lagos viewer sees Bola/Emeka; zero name overlap between the two payloads |
| Each viewer's own city label | "Zaria, Kaduna" and "Lagos" respectively |
| Off-board viewer | Rank 14 pinned below a ten-row board, absent from the rows |
| Null-city agent | No section at all (fixed during the pass) |
| Empty board | Encouraging one-liner, no rows (fixed during the pass) |
| Flag off | Board gone, challenge and tier badge untouched |
| /challenges with challenges off + board on | Reachable, board takes the h1 |
| **Express tier override** | Silver agent, 45,000 request (above the 20,000 global, under the 90,000 tier ceiling) came back `express: true`; a no-tier agent's identical request came back `express: false` |
| **Tier-up on the crossing activation** | Delivery taking the agent to 1 activation queued only the commission push. The next delivery, landing on Bronze's threshold of 2, queued `tier_up` with title "You're now a Bronze agent", body "2 of your customers now order on BiteExpress.", url `/profile` |

### Absent-tier artifacts

The status image is byte-identical: SHA-256 `702bc51179a34836…` from both the
pre-H1 build and the H1 build, 1,272,789 bytes each.

The poster's no-tier render on the H1 build produced SHA-256
`b4ed0c2cb2124d59…` / 236,574 bytes, which is exactly one of the hashes the
**unmodified pre-H1 build** produced. That build alone produced three different
poster hashes across three runs (236,574 / 236,568 / 236,567 bytes), so the
poster is not byte-stable run to run on either build. The variance predates
H1 and is almost certainly font-load timing: the poster is the only artifact
that draws with the serif face. Structurally the no-tier path is unchanged,
because `drawTierMark` returns before drawing and is the last call in both
renderers.

Read plainly: absent-tier output matches a pre-H1 render exactly, but "byte
identical on every run" is not a property the poster had before this phase
either.

### Defects found and fixed during the pass

All three were caught by the seeded pass, not by the suites, and are in
`4269401`:

1. A null-city agent was shown the section with an empty state. The server
   correctly returns the empty shape with `city_label` null; the PWA rendered
   it anyway. A missing `city_label` now counts as no board, which also stops
   that agent landing on a blank screen when challenges are off.
2. An empty board pinned the viewer at rank 1 with zero first orders, directly
   under "Nobody has scored yet this week". That is precisely the fake row the
   empty state exists to avoid. The pinned row is now only for a board that
   already has someone on it.
3. The "Last week" heading rendered in serif. Headings default to serif
   app-wide and every other heading opts out; serif is reserved for the
   certification moment and the home greeting.

## Cleanliness

| Repo | `git status` | Dependency diff |
|---|---|---|
| dashboard.bite.express | clean | none (`composer.json`, `composer.lock`, `package.json`, `package-lock.json` untouched) |
| biteexpress-agents | clean | none (`package.json`, `package-lock.json` untouched) |

No new dependencies in either repo. All scratch files, seeds and screenshots
live in the session scratchpad, outside both trees.

## Deviations

1. **The tier-up push was verified as far as the queue, not to a phone.**
   The full production path runs: order delivered → observer →
   `AgentCommissionService` → activation → `AgentPushService` → a
   `SendAgentPushJob` row on the `database` queue carrying the exact title,
   body and URL, firing on the threshold activation and staying quiet on the
   one before and after. What is not verified is the last hop, an actual
   notification arriving in a browser. `Notification.requestPermission()`
   inside the automation harness blocks on a permission prompt with no way to
   answer it; the run hung for 30 minutes before aborting. A prior session
   established that live web push on this machine needs Edge with a
   profile-level permission grant, which the harness cannot drive. The push
   transport itself is unchanged by H1: `tier_up` is one more event through the
   F1 sender that already delivers commission and withdrawal pushes in
   production.

2. **No server-side leaderboard cache.** The plan permits a per city+week cache
   up to five minutes. Not built. The board is two queries over a single city,
   `you` and `is_you` are viewer-specific so only the city-wide half would be
   cacheable, and a cache would have made the city-isolation checks harder to
   trust. Straightforward to add later if a city ever gets big enough to need
   it.

3. **The leaderboard is gated on `agent_program_active` as well as its own
   flag.** The frozen decision names only `agent_leaderboard_enabled`. Gating
   on both matches `AgentChallengeController` exactly and means turning the
   whole programme off turns the board off too. Strictly more fail-closed than
   specified.

4. **A pre-existing uncommitted deletion of
   `docs/specs/2026-07-13-agent-program-design.md` was restored, not
   committed.** It was already deleted in the agents working tree when this
   phase started, from some earlier session. Restoring recovers 204 lines of
   the design spec and is reversible; deleting it is not, and it was not this
   phase's call to make. Flagging it in case the deletion was deliberate.

5. **Commit subjects follow each repo's own convention**: plain imperative in
   the dashboard, `feat:` / `fix:` in the agents repo, matching what is already
   in each log rather than one style across both.

## Notes for the gate

- Nothing is visible to any agent until an admin opens
  **Agent program → settings**, fills the ladder, and saves. The ladder editor
  validates as a set: one bad row rejects the whole submission rather than
  half-saving a ladder.
- Thresholds are counts of customers who have actually ordered, never signups,
  and the count only goes up. There is no demotion path and no copy implying
  one.
- The only perk a tier carries is the express withdrawal ceiling that already
  exists. A tier can raise an agent's ceiling; it can never open the lane when
  the global setting is zero, lower a ceiling, or skip KYC or the clean-payout
  rule.
- A board row exposes a first name, a tier name and two counts. A test asserts
  the field list exactly, and another asserts no surname appears anywhere in
  the payload.
- Changing the ladder re-tiers agents silently and sends no push, as decided.
  An agent could gain or lose a badge with no explanation; worth a word in the
  admin help text if finance expects to tune thresholds often.
