"use client";

import { useEffect, useState } from "react";

/**
 * Ticks once a second toward an ISO8601 target. Returns milliseconds remaining
 * (0 when expired or the target is missing/invalid) and an `expired` flag.
 */
export function useCountdown(targetIso: string | null | undefined) {
  const target = targetIso ? new Date(targetIso).getTime() : NaN;
  const valid = Number.isFinite(target);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!valid) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [valid]);

  const remaining = valid ? Math.max(0, target - now) : 0;
  return { remaining, expired: !valid || remaining <= 0, valid };
}

/** mm:ss (or h:mm:ss past an hour) for a millisecond duration. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
