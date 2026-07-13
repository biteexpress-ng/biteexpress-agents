import { Logo } from "./logo";

/**
 * The BiteExpress wordmark with the "Agents" sub-brand tucked under its right
 * edge, so the mark reads as "BiteExpress Agents". Used on the unauthenticated
 * surface so agents know they're in the right place, not the customer app.
 */
export function AgentLockup({
  height = 30,
  priority = false,
}: {
  height?: number;
  priority?: boolean;
}) {
  return (
    <div className="inline-flex flex-col items-end">
      <Logo variant="light" height={height} priority={priority} />
      <span className="mt-1 font-sans text-[0.68rem] font-semibold uppercase leading-none tracking-[0.28em] text-brand-red">
        Agents
      </span>
    </div>
  );
}
