import { cn } from "@/lib/utils";

interface StatPairProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

/** Quiet label over a tabular number. Deliberately not an icon+number stat tile
 *  (PRODUCT.md anti-reference) — numbers are the interface, chrome is second. */
export function StatPair({ label, value, className }: StatPairProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
        {value}
      </span>
    </div>
  );
}
