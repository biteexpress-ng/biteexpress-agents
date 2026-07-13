import { api } from "./client";
import type {
  AgentProfile,
  QuizResult,
  QuizStart,
  TrainingVideo,
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
