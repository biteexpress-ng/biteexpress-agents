import { api } from "./client";
import type {
  AgentProfile,
  AssistedConfirmResponse,
  CustomerList,
  EarningsResponse,
  KycStatusResponse,
  QuizInfo,
  QuizResult,
  QuizStart,
  TrainingVideo,
  WithdrawalsResponse,
  WithdrawRequestResult,
} from "./types";

export function setupPassword(input: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return api("/auth/setup-password", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export function login(input: {
  login: string;
  password: string;
  platform?: string;
}): Promise<{ token: string; agent: AgentProfile }> {
  return api("/auth/login", { method: "POST", body: input, auth: false });
}

export function logout(): Promise<{ message: string }> {
  return api("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<{ agent: AgentProfile }> {
  return api("/me");
}

export function getTrainingVideos(): Promise<{
  videos: TrainingVideo[];
  training_complete: boolean;
}> {
  return api("/training/videos");
}

export function markVideoWatched(
  id: number,
): Promise<{ watched: boolean; training_complete: boolean }> {
  return api(`/training/videos/${id}/watch`, { method: "POST" });
}

export function startQuiz(): Promise<QuizStart> {
  return api("/quiz/start");
}

export function submitQuiz(input: {
  attempt_id: number;
  answers: Record<number, number>;
}): Promise<QuizResult> {
  return api("/quiz/submit", { method: "POST", body: input });
}

export function getQuizInfo(): Promise<QuizInfo> {
  return api("/quiz/info");
}

export function getCustomers(page = 1): Promise<CustomerList> {
  return api(`/customers?page=${page}`);
}

export function getEarnings(page = 1): Promise<EarningsResponse> {
  return api(`/earnings?page=${page}`);
}

export function initiateAssistedSignup(input: {
  phone: string;
}): Promise<{ message?: string }> {
  return api("/customers/assisted/initiate", { method: "POST", body: input });
}

export function confirmAssistedSignup(input: {
  phone: string;
  otp: string;
  first_name: string;
  last_name: string;
}): Promise<AssistedConfirmResponse> {
  return api("/customers/assisted/confirm", { method: "POST", body: input });
}

export function getKyc(): Promise<KycStatusResponse> {
  return api("/kyc");
}

export function submitKyc(
  form: FormData,
): Promise<{ message: string; kyc_status: "pending" }> {
  return api("/kyc", { method: "POST", body: form });
}

export function requestWithdraw(input: {
  amount: number;
}): Promise<{ request: WithdrawRequestResult }> {
  return api("/withdraw", { method: "POST", body: input });
}

export function getWithdrawals(page = 1): Promise<WithdrawalsResponse> {
  return api(`/withdrawals?page=${page}`);
}
