import { AgentLockup } from "@/components/brand/agent-lockup";

/**
 * Pre-certification / unauthenticated surface: a focused, linear single column.
 * No bottom nav — nothing competes with the one job on each screen.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-md flex-1 flex-col">
        <div className="mb-10 flex justify-center">
          <AgentLockup height={30} priority />
        </div>
        {children}
      </div>
    </main>
  );
}
