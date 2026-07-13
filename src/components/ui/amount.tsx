import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/format";

interface AmountProps {
  value: number;
  /** When true, a positive value renders as a green "+₦…" credit. */
  sign?: boolean;
  className?: string;
}

/**
 * Money, styled per the design contract: tabular figures, ink-900 by default,
 * never brand red. Negatives (reversals) get a minus and stay ink; credits with
 * `sign` get a green plus. Error red is never used for money.
 */
export function Amount({ value, sign = false, className }: AmountProps) {
  const isCredit = value > 0;
  const prefix = value < 0 ? "−" : sign && isCredit ? "+" : "";

  return (
    <span
      className={cn(
        "tabular-nums",
        sign && isCredit
          ? "text-[color:var(--color-success-strong)]"
          : "text-ink-900",
        className,
      )}
    >
      {prefix}
      {formatNaira(value)}
    </span>
  );
}
