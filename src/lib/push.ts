import { getPushConfig, subscribePush, unsubscribePush } from "@/lib/api/agent";

/**
 * Client-side web push plumbing. The browser permission prompt is only ever
 * triggered from `enablePush()`, which callers must invoke from an explicit
 * user tap, never on page load.
 */

export type PushSupport = "supported" | "unsupported" | "needs_install";

const SW_URL = "/agent-sw.js";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; the touch check catches it.
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari-only flag, present when launched from the home screen.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS Safari only exposes the Push API to installed PWAs (16.4+), so an iOS
 * browser tab is `needs_install`, not `unsupported`.
 */
export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "needs_install";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return "supported";
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/** VAPID public key (base64url) -> the Uint8Array the Push API wants. */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * The full opt-in flow, called from a user tap: permission prompt, service
 * worker registration, push subscription, and the POST to the backend.
 * Returns the resulting permission so callers can react to a denial quietly.
 */
export async function enablePush(): Promise<NotificationPermission> {
  const config = await getPushConfig();
  if (!config.enabled || !config.public_key) {
    throw new Error("Push is not available right now.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const reg = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        config.public_key,
      ) as unknown as BufferSource,
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Couldn't set up notifications. Please try again.");
  }

  await subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    user_agent: navigator.userAgent,
  });

  return permission;
}

/** Mirror of enablePush: tell the backend first, then drop the subscription. */
export async function disablePush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  await unsubscribePush({ endpoint: sub.endpoint });
  await sub.unsubscribe();
}
