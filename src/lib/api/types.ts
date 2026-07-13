export interface AgentProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  status: "pending" | "approved" | "certified" | "suspended";
  referral_code: string | null;
  training_complete: boolean;
  certified: boolean;
}

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public errors: ApiError[],
    public raw?: unknown,
  ) {
    super(errors[0]?.message ?? `Request failed (${status})`);
    this.name = "ApiRequestError";
  }
}

export interface TrainingVideo {
  id: number;
  youtube_video_id: string;
  title: string;
  sort_order: number;
  duration_seconds: number | null;
  watched: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
}

export interface QuizStart {
  attempt_id: number;
  pass_mark: number;
  questions: QuizQuestion[];
}

export interface QuizResult {
  status: "passed" | "failed";
  /** Percentage, 0–100. */
  score: number;
  /** Percentage, 0–100. */
  pass_mark: number;
  certified: boolean;
  referral_code: string | null;
  /** ISO8601 cooldown expiry, present on failure. */
  retry_at?: string | null;
}

export interface QuizInfo {
  question_count: number;
  /** Percentage, 0–100. */
  pass_mark: number;
  cooldown_minutes: number;
}

/** 403 body from the quiz flow */
export interface QuizGateError {
  code: "training-incomplete" | "cooldown" | "no-questions" | "already-certified";
  retry_at?: string;
}

/** Shared pagination block on the list endpoints. */
export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ReferredCustomer {
  id: number;
  name_masked: string;
  signup_channel: "code" | "assisted";
  status: "registered" | "activated";
  joined_at: string;
  first_order_at: string | null;
  orders_count: number;
  commission_total: number;
}

export interface CustomerList {
  customers: ReferredCustomer[];
  stats: { total: number; activated: number };
  pagination: Pagination;
}

export interface LedgerEntry {
  id: number;
  type: "order_commission" | "reversal" | "challenge_bonus" | "manual_bonus";
  status: "confirmed" | "reversed";
  amount: number;
  order_id: number | null;
  note: string | null;
  created_at: string;
}

export type WithdrawReason =
  | "kyc-not-verified"
  | "below-minimum"
  | "request-pending";

export interface WithdrawEligibility {
  can_withdraw: boolean;
  min_amount: number;
  kyc_status: KycStatus;
  reason: WithdrawReason | null;
}

export interface EarningsResponse {
  balances: { withdrawable: number; pending: number; earned_total: number };
  ledger: LedgerEntry[];
  eligibility: WithdrawEligibility;
  pagination: Pagination;
}

export interface AssistedConfirmResponse {
  customer: { name_masked: string; status: string };
  message?: string;
}

export type KycStatus = "incomplete" | "pending" | "verified" | "rejected";

export type IdentityType =
  | "nin"
  | "drivers_license"
  | "voters_card"
  | "passport";

export interface KycStatusResponse {
  kyc_status: KycStatus;
  rejection_reason: string | null;
  photo_url: string | null;
  identity_type: IdentityType | null;
  identity_image_url: string | null;
  bank: {
    bank_name: string | null;
    account_number_masked: string | null;
    account_name: string | null;
  };
}

export interface WithdrawRequestResult {
  id: number;
  amount: number;
  status: "pending";
  created_at: string;
}

export interface WithdrawalEntry {
  id: number;
  amount: number;
  status: "pending" | "approved" | "denied";
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface WithdrawalsResponse {
  withdrawals: WithdrawalEntry[];
  pagination: Pagination;
}

/** One rung of the weekly challenge ladder. Ascending by signup_target. */
export interface ChallengeTier {
  name: string;
  signup_target: number;
  activation_target: number;
  bonus_amount: number;
  achieved: boolean;
}

/** This week's live progress. Counts are computed server-side from referrals. */
export interface ChallengeCurrent {
  week_key: string;
  /** ISO-8601 UTC; render in the device's local time (Lagos for agents). */
  week_ends_at: string;
  signups: number;
  activations: number;
  tiers: ChallengeTier[];
  /** Highest tier reached this week, or null. Paid Monday to the available balance. */
  achieved_tier: string | null;
}

/** A past win. Newest-first, capped at 12 by the API. */
export interface ChallengeAward {
  week_key: string;
  tier_name: string;
  bonus_amount: number;
  signups: number;
  activations: number;
  /** ISO-8601 UTC. */
  awarded_at: string;
}

/**
 * GET /challenge. `active` is false when the program/challenge flags are off or
 * no tiers are configured; then `current` is null and `past_awards` is empty and
 * the feature is hidden everywhere.
 */
export interface ChallengeStatus {
  active: boolean;
  current: ChallengeCurrent | null;
  past_awards: ChallengeAward[];
}
