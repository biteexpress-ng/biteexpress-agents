import { CalendarClock } from "lucide-react";
import type { LeaderboardResponse, LeaderboardRow as Row } from "@/lib/api/types";
import { formatWeekDeadline } from "@/lib/format";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-row";

interface LeaderboardSectionProps {
  board: LeaderboardResponse;
  /** The viewer's own details, for the pinned row when they are off-board. */
  viewer: { firstName: string; tierName: string | null };
  /** h1 when the leaderboard is the only live section on the screen. */
  as?: "h1" | "h2";
}

/**
 * The city board.
 *
 * This is the one competitive surface in an otherwise calm product, so it gets
 * a real heading and full-width rows, and nothing else: no medals, no streaks,
 * no prize copy. Position is the whole reward, and the money stays in
 * challenges where it can be counted.
 *
 * The viewer always sees their own line. If they are outside the top ten it is
 * pinned below the board with their real rank, because a board you cannot find
 * yourself on is just other people's news.
 */
export function LeaderboardSection({
  board,
  viewer,
  as = "h2",
}: LeaderboardSectionProps) {
  // No city, no board. The server withholds the city rather than guessing one,
  // so there is nothing here to render and no section to head.
  if (!board.enabled || !board.city_label) return null;

  const rows = board.rows ?? [];
  const lastWeek = board.last_week_top ?? [];
  const you = board.you ?? null;
  const deadline = formatWeekDeadline(board.week_ends_at);
  const Heading = as;

  // Off-board: the server already computed the real rank, so the pinned row is
  // the same component with the viewer's own name filled in. Never pinned to an
  // empty board, where a "rank 1, 0 first orders" line would contradict the
  // empty state directly above it and read as the fake row it is.
  const pinned: Row | null =
    you && rows.length > 0 && !rows.some((r) => r.is_you)
      ? {
          rank: you.rank,
          first_name: viewer.firstName || "You",
          tier_name: viewer.tierName,
          signups: you.signups,
          activations: you.activations,
          is_you: true,
        }
      : null;

  return (
    <section>
      <Heading
        className={
          as === "h1"
            ? "font-sans text-xl font-semibold text-ink-900"
            : "font-sans text-base font-semibold text-ink-900"
        }
      >
        Your city this week
      </Heading>
      <p className="mt-1 text-sm text-muted-foreground">
        Agents in {board.city_label}.
      </p>
      {deadline && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          {deadline}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
          <p className="text-base font-medium text-ink-900">
            Nobody has scored yet this week
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign up one customer and you are top of your city.
          </p>
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <LeaderboardRow key={row.rank} row={row} />
          ))}
        </ol>
      )}

      {pinned && (
        <ol className="mt-3 flex flex-col gap-3">
          <LeaderboardRow row={pinned} />
        </ol>
      )}

      {lastWeek.length > 0 && (
        <div className="mt-6">
          {/* Headings default to serif app-wide; serif is reserved for the
              certification moment and the home greeting. */}
          <h3 className="font-sans text-sm font-medium text-ink-800">
            Last week
          </h3>
          <ol className="mt-2 flex flex-col gap-1.5">
            {lastWeek.map((row) => (
              <li
                key={`last-${row.rank}`}
                className="flex items-baseline gap-2 text-sm text-muted-foreground"
              >
                <span className="w-4 shrink-0 tabular-nums text-ink-700">
                  {row.rank}
                </span>
                <span className="truncate font-medium text-ink-800">
                  {row.first_name}
                  {row.is_you && " (you)"}
                </span>
                <span className="shrink-0 tabular-nums">
                  {row.activations}{" "}
                  {row.activations === 1 ? "first order" : "first orders"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
