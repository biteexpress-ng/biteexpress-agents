"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, House, User, Users, Wallet } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

/** Certified-only bottom navigation — five items, the platform maximum. */
const ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const certified = useAuthStore((s) => s.agent?.certified);

  if (!certified) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-brand-red" : "text-ink-500 hover:text-ink-800",
                )}
              >
                <Icon className="size-6" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
