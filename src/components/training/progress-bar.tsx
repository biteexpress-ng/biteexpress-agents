interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
}

/** Thin brand-red training progress bar. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? `${value} of ${max} complete`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
    >
      <div
        className="h-full rounded-full bg-brand-red transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
