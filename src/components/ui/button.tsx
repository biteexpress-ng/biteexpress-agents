"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

const base =
  "relative inline-flex min-h-12 cursor-pointer select-none items-center justify-center " +
  "gap-2 rounded-xl px-5 text-base font-semibold leading-none " +
  "transition-[transform,background-color,box-shadow,filter] duration-150 " +
  "ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-red text-primary-foreground shadow-soft hover:bg-brand-red-600 active:bg-brand-red-600",
  secondary:
    "border border-border-strong bg-surface text-ink-900 hover:bg-canvas-sunken active:bg-canvas-sunken",
  ghost: "bg-transparent text-ink-900 hover:bg-canvas-sunken active:bg-canvas-sunken",
};

/**
 * Compose the button look for a non-<button> element (e.g. a Next <Link>).
 * Keeps link-styled-as-button visually identical without a polymorphic API.
 */
export function buttonClassName({
  variant = "primary",
  fullWidth = false,
  className,
}: {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], fullWidth && "w-full", className);
}

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], fullWidth && "w-full", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </span>
      )}
      {/* Keep the label in the DOM while loading so the button width is stable. */}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
    </button>
  );
}
