import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-5">
        {children}
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
