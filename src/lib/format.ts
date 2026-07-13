/**
 * Naira, magnitude only (the sign is the caller's / <Amount>'s job). The ₦ glyph
 * is prefixed manually rather than via Intl currency formatting so the output is
 * deterministic (no "NGN" fallbacks) regardless of the runtime's locale data.
 */
export function formatNaira(n: number): string {
  const magnitude = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₦${magnitude}`;
}

/** Short date, e.g. "14 Jul". Empty string for an unparseable input. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
