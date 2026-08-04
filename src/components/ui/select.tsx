import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: React.Ref<HTMLSelectElement>;
};

/** Native select styled to match Input, with a drawn chevron over the control. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "min-h-12 w-full appearance-none rounded-xl border border-border bg-surface pl-4 pr-11 text-base text-ink-900",
          "shadow-hairline",
          "transition-[border-color,box-shadow] duration-150",
          "focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/70",
          "focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
          "aria-[invalid=true]:border-error aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-error/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-ink-500"
        aria-hidden
      />
    </div>
  );
}
