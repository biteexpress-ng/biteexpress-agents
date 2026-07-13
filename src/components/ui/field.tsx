import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  /** id of the control this label points at */
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Label-above-control field with a hint/error slot. Errors are announced
 * (role="alert") and colored via the error token; the message states cause + fix.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-800">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
