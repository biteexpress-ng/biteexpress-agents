"use client";

import { useEffect, useState } from "react";
import { Bell, Share } from "lucide-react";
import { getPushConfig } from "@/lib/api/agent";
import {
  disablePush,
  enablePush,
  getExistingSubscription,
  getPushPermission,
  getPushSupport,
  type PushSupport,
} from "@/lib/push";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared soft opt-in state for the home card and the profile toggle. The
 * browser permission prompt only ever fires from an explicit tap; this hook
 * just observes.
 */
function usePushState() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const s = getPushSupport();
    setSupport(s);
    getPushConfig()
      .then((config) => setEnabled(config.enabled && !!config.public_key))
      .catch(() => setEnabled(false));
    if (s === "supported" && getPushPermission() === "granted") {
      getExistingSubscription()
        .then((sub) => setSubscribed(!!sub))
        .catch(() => setSubscribed(false));
    }
  }, []);

  return { support, enabled, subscribed, setSubscribed };
}

/**
 * Soft opt-in card on the home screen. Renders nothing until the push config
 * confirms the feature is on, and hides itself once the browser permission is
 * settled either way (a denied prompt is nearly unrecoverable, so we never nag).
 */
export function NotificationsCard({ className }: { className?: string }) {
  const { support, enabled } = usePushState();
  const [phase, setPhase] = useState<"idle" | "working" | "on" | "hidden">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  if (support === null || enabled === null || !enabled) return null;
  if (support === "unsupported") return null;
  if (phase === "hidden") return null;

  if (support === "needs_install") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-surface p-5 shadow-soft",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-brand-red/10 text-brand-red">
            <Bell className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-medium text-ink-900">
              Get notified when you earn
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add BiteExpress Agents to your home screen to get notifications.
              Tap{" "}
              <Share
                className="inline size-4 align-text-bottom text-ink-700"
                aria-label="the share button"
              />{" "}
              in Safari, then &quot;Add to Home Screen&quot;.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const permission = getPushPermission();
  if (phase !== "on" && (permission === "granted" || permission === "denied")) {
    return null;
  }

  if (phase === "on") {
    return (
      <div
        role="status"
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft",
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-[color:var(--color-success-strong)]">
          <Bell className="size-5" aria-hidden />
        </span>
        <p className="text-base font-medium text-ink-900">
          Notifications are on.
        </p>
      </div>
    );
  }

  async function onEnable() {
    setPhase("working");
    setError(null);
    try {
      const result = await enablePush();
      if (result === "granted") {
        setPhase("on");
      } else {
        // Denied or dismissed: stop asking, quietly.
        setPhase(result === "denied" ? "hidden" : "idle");
      }
    } catch {
      setError("Couldn't turn on notifications. Please try again.");
      setPhase("idle");
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-brand-red/10 text-brand-red">
          <Bell className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-base font-medium text-ink-900">
            Know the second you earn
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A ping on your phone when a commission lands.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}
      <Button
        variant="secondary"
        fullWidth
        className="mt-4"
        loading={phase === "working"}
        onClick={() => void onEnable()}
      >
        Turn on notifications
      </Button>
    </div>
  );
}

/**
 * Profile row with the on/off switch. Hidden while push is unavailable;
 * on iOS Safari outside the installed app it explains instead of toggling.
 */
export function NotificationsRow() {
  const { support, enabled, subscribed, setSubscribed } = usePushState();
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (support === null || enabled === null || !enabled) return null;
  if (support === "unsupported") return null;

  const on = subscribed && getPushPermission() === "granted";

  async function onToggle() {
    if (working) return;
    setWorking(true);
    setNote(null);
    try {
      if (on) {
        await disablePush();
        setSubscribed(false);
      } else {
        const result = await enablePush();
        if (result === "granted") {
          setSubscribed(true);
        } else if (result === "denied") {
          setNote(
            "Notifications are blocked for this site. Allow them in your browser settings, then try again.",
          );
        }
      }
    } catch {
      setNote("Couldn't update notifications. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-soft">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-medium text-ink-900">
            Earning notifications
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A ping when a commission lands.
          </p>
        </div>
        {support === "needs_install" ? (
          <p className="max-w-[9rem] shrink-0 text-right text-sm text-muted-foreground">
            Add to home screen first
          </p>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Earning notifications"
            aria-busy={working || undefined}
            disabled={working}
            onClick={() => void onToggle()}
            className={cn(
              "relative box-content h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent p-2",
              "transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-2 rounded-full transition-colors duration-150",
                on ? "bg-brand-red" : "bg-canvas-sunken border border-border-strong",
              )}
            />
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow-soft transition-[left] duration-150",
                on ? "left-[2.125rem]" : "left-[0.625rem]",
              )}
            />
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
