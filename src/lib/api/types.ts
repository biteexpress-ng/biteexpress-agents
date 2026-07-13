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
  score: number;
  pass_mark: number;
  certified: boolean;
  referral_code: string | null;
}

/** 403 body from the quiz flow */
export interface QuizGateError {
  code: "training-incomplete" | "cooldown" | "no-questions" | "already-certified";
  retry_at?: string;
}
