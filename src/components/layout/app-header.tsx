"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/api/agent";
import { useAuthStore } from "@/stores/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/training": "Training",
  "/quiz": "Quiz",
  "/profile": "Profile",
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = TITLES[pathname] ?? "BiteExpress";

  async function onConfirm() {
    setLoading(true);
    try {
      await logout();
    } catch {
      // Network/expired token — clear locally regardless so the user is out.
    }
    clear();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5">
        <span className="font-sans text-base font-semibold text-ink-900">
          {title}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Log out"
          className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink-600 transition-colors hover:bg-canvas-sunken hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </div>

      <ConfirmDialog
        open={open}
        title="Log out?"
        description="You'll need to sign in again to see your dashboard."
        confirmLabel="Log out"
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
        loading={loading}
      />
    </header>
  );
}
