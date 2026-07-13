import { cn } from "@/lib/utils";

type Tone = "error" | "info" | "success" | "warning";

const toneSurface: Record<Tone, string> = {
  error: "border-error/25 bg-error-soft",
  info: "border-info/25 bg-[color-mix(in_srgb,var(--color-info)_8%,#ffffff)]",
  success: "border-success/25 bg-success-soft",
  warning: "border-warning/30 bg-warning-soft",
};

const toneIcon: Record<Tone, string> = {
  error: "text-error",
  info: "text-info",
  success: "text-[color:var(--color-success)]",
  warning: "text-[color:var(--color-warning)]",
};

interface AlertProps {
  tone?: Tone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** role="alert" announces on mount; use "status" for non-urgent info. */
  live?: "alert" | "status";
}

/**
 * Full-width inline notice. Body text stays ink-800 (contrast-safe on the soft
 * tint); the tone is carried by the border + a colored icon, so color is never
 * the only signal.
 */
export function Alert({
  tone = "error",
  icon,
  children,
  className,
  live = "alert",
}: AlertProps) {
  return (
    <div
      role={live}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 text-sm",
        toneSurface[tone],
        className,
      )}
    >
      {icon && (
        <span className={cn("mt-0.5 shrink-0", toneIcon[tone])} aria-hidden>
          {icon}
        </span>
      )}
      <div className="text-ink-800">{children}</div>
    </div>
  );
}
