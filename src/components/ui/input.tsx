import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-ink-900",
        "shadow-hairline placeholder:text-ink-400",
        "transition-[border-color,box-shadow] duration-150",
        "focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/70",
        "focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-[invalid=true]:border-error aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-error/40",
        className,
      )}
      {...props}
    />
  );
}
