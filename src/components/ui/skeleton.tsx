import { cn } from "@/lib/utils";

/** Shimmer placeholder for loading content (never a spinner mid-content). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} aria-hidden />;
}
