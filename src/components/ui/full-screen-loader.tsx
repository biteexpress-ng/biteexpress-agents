import { Loader2 } from "lucide-react";

/** Brief brand-neutral gate shown while the session/profile is resolving. */
export function FullScreenLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <Loader2 className="size-7 animate-spin text-ink-400" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
