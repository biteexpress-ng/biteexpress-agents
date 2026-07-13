import { useAuthStore } from "@/stores/auth";
import { ApiError, ApiRequestError } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const PREFIX = "/api/v1/agent";

export interface ApiOptions extends Omit<RequestInit, "body"> {
  /** JSON body — serialized automatically. */
  body?: unknown;
  /** Attach the stored Bearer token. Default true; set false for login/setup. */
  auth?: boolean;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Normalize the API's two error shapes into ApiError[]:
 *  - standard:   { errors: [{ code, message }] }
 *  - quiz gate:  { code, retry_at? }  (HTTP 403)
 * The full parsed body is preserved on ApiRequestError.raw so callers
 * (e.g. the quiz gate) can read fields like retry_at.
 */
function extractErrors(data: unknown, status: number): ApiError[] {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.errors) && d.errors.length > 0) {
      return d.errors as ApiError[];
    }
    if (typeof d.code === "string") {
      return [
        {
          code: d.code,
          message: typeof d.message === "string" ? d.message : d.code,
        },
      ];
    }
    if (typeof d.message === "string") {
      return [{ code: "error", message: d.message }];
    }
  }
  return [{ code: "unknown", message: `Request failed (${status})` }];
}

/**
 * Fetch wrapper for the Phase A1 agent API. Prefixes the base URL + /api/v1/agent,
 * attaches the Bearer token, and — critically — surfaces the server's error body
 * instead of swallowing it (lesson from the web-app checkout bug: a blank error
 * toast is worse than a wrong one). On a 401 from an authed call it clears the
 * session and bounces to /login.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const token = auth ? useAuthStore.getState().token : null;

  let res: Response;
  try {
    res = await fetch(`${BASE}${PREFIX}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network / DNS / offline — give the UI something honest to show.
    throw new ApiRequestError(0, [
      {
        code: "network",
        message: "Can't reach the server. Check your connection and try again.",
      },
    ]);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    if (res.status === 401 && auth) {
      useAuthStore.getState().clear();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = "/login";
      }
    }
    throw new ApiRequestError(res.status, extractErrors(data, res.status), data);
  }

  return data as T;
}
