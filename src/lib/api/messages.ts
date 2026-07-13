import { formatNaira } from "@/lib/format";

/**
 * The single source of plain-language copy for every KYC/withdrawal gate code
 * the C1 API can return. Reused by the earnings CTA, the withdraw form, and the
 * profile so a blocked payout is always explained — the CTA never silently
 * disappears.
 */
export function gateMessage(code: string, ctx?: { min?: number }): string {
  switch (code) {
    case "kyc-not-verified":
      return "Finish your payout setup first";
    case "below-minimum":
      return ctx?.min != null
        ? `Minimum withdrawal is ${formatNaira(ctx.min)}`
        : "That's below the minimum withdrawal";
    case "insufficient-balance":
      return "That's more than your balance";
    case "request-pending":
      return "You already have a request being reviewed";
    case "kyc-locked":
      return "Your details are being reviewed";
    default:
      return "Something went wrong. Please try again.";
  }
}
