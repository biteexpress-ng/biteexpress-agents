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

export interface EarningsResponse {
  balances: { withdrawable: number; pending: number; earned_total: number };
  ledger: LedgerEntry[];
  pagination: Pagination;
}

export interface AssistedConfirmResponse {
  customer: { name_masked: string; status: string };
  message?: string;
}
