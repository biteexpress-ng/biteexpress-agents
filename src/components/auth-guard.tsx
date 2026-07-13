"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api/agent";
import { useAuthStore } from "@/stores/auth";
import { FullScreenLoader } from "@/components/ui/full-screen-loader";

/** Routes an uncertified agent may reach. Everything else redirects to /training. */
const UNCERTIFIED_ALLOWED = ["/training", "/quiz"];

function isAllowedForUncertified(pathname: string): boolean {
  return UNCERTIFIED_ALLOWED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Client gate for the (app) group. Waits for persisted storage to hydrate,
 * bounces unauthenticated users to /login, refreshes the profile once so
 * certification state stays current, and enforces Phase-A gating: until an
 * agent is certified, only /training and /quiz are reachable.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const agent = useAuthStore((s) => s.agent);
  const setAgent = useAuthStore((s) => s.setAgent);

  // Refresh the profile once we have a token (keeps certified/training current).
  useEffect(() => {
    if (!hydrated || !token) return;
    let active = true;
    getMe()
      .then((res) => {
        if (active) setAgent(res.agent);
      })
      .catch(() => {
        // 401 is handled by the API client (clears + redirects); other errors
        // (offline, 5xx) keep the cached profile so the app stays usable.
      });
    return () => {
      active = false;
    };
  }, [hydrated, token, setAgent]);

  // Redirect unauthenticated visitors.
  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  // Enforce certification gating.
  useEffect(() => {
    if (!hydrated || !token || !agent) return;
    if (!agent.certified && !isAllowedForUncertified(pathname)) {
      router.replace("/training");
    }
  }, [hydrated, token, agent, pathname, router]);

  // Hold the UI until we know who this is — avoids a login/content flash.
  if (!hydrated || !token || !agent) {
    return <FullScreenLoader label="Checking your session" />;
  }
  if (!agent.certified && !isAllowedForUncertified(pathname)) {
    return <FullScreenLoader label="Taking you to training" />;
  }

  return <>{children}</>;
}
