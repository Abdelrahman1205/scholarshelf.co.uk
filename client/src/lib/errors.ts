/**
 * client/src/lib/errors.ts
 *
 * One place that turns a thrown API error into something a person can act on.
 *
 * THE BUG THIS EXISTS TO FIX
 *
 * queryClient.ts used to throw `new Error("409: {json}")` — status and body
 * glued into one string. It was later changed to throw a clean `err.message`
 * with the status on `err.status` and the parsed body on `err.body`, which is
 * the right shape. Four call sites were never updated and still parse the OLD
 * format, so their branches are all dead:
 *
 *   err.message.includes("409")   — the message no longer contains the status
 *   msg.indexOf(": ")             — the message is no longer "status: body"
 *
 * Every one of those falls through to a generic sentence. The worst is parent
 * registration: shared/schema.ts enforces /^[a-zA-Z0-9_.-]+$/ on usernames while
 * the form only sets minLength={3}, so a parent called O'Brien — or anyone who
 * types their email address, or a space — is rejected. The server explains
 * exactly why in `err.body.errors`, and the page throws it away and says
 * "Registration failed. Please try again." They can retry forever without ever
 * being told the rule.
 */

/** The error shape queryClient.ts actually throws. */
export interface ApiError extends Error {
  status?: number;
  body?: {
    message?: string;
    /** Zod fieldErrors: { username: ["..."], email: ["..."] } */
    errors?: Record<string, string[] | undefined>;
    [key: string]: unknown;
  } | null;
}

/** Per-field messages from a 400, in form order where the caller gives one. */
export function fieldErrors(err: unknown, order: string[] = []): Record<string, string> {
  const raw = (err as ApiError)?.body?.errors;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    const first = raw[key]?.[0];
    if (first) out[key] = first;
  }
  if (!order.length) return out;
  const sorted: Record<string, string> = {};
  for (const key of order) if (out[key]) sorted[key] = out[key];
  for (const key of Object.keys(out)) if (!(key in sorted)) sorted[key] = out[key];
  return sorted;
}

/**
 * The sentence to show the user.
 *
 * Order of preference, and the order matters:
 *   1. A specific per-field complaint — "Username may only contain letters,
 *      numbers, dots, dashes and underscores." This is the one that tells them
 *      what to change.
 *   2. The server's own message. It is written for this situation.
 *   3. A status-specific fallback, for the cases where the server said nothing
 *      useful (a proxy 502, a bare 429).
 *   4. The caller's generic line, last.
 *
 * `statusMessages` lets a caller override a status where it knows better than a
 * generic phrasing — e.g. 400 on the reset-password page means the link expired,
 * which the server cannot say without confirming the token existed.
 */
export function describeApiError(
  err: unknown,
  options: { fallback?: string; statusMessages?: Record<number, string> } = {},
): string {
  const apiError = err as ApiError;
  const status = apiError?.status;

  const fields = fieldErrors(err);
  const firstField = Object.values(fields)[0];
  if (firstField) return firstField;

  const override = status != null ? options.statusMessages?.[status] : undefined;

  const serverMessage = apiError?.body?.message || apiError?.message;
  // "Failed to fetch" is what the browser says when the network dropped; it is
  // not a server message and reads like a bug report.
  const usableServerMessage =
    serverMessage && !/^failed to fetch$/i.test(serverMessage) ? serverMessage : undefined;

  if (override) return override;
  if (usableServerMessage) return usableServerMessage;

  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You do not have permission to do that.";
    case 404: return "That record could not be found.";
    case 409: return "That conflicts with something that already exists.";
    case 429: return "Too many attempts. Please wait a moment and try again.";
    case 502:
    case 503:
    case 504: return "The server is not responding. Please try again shortly.";
    default:
      return options.fallback
        || (status == null
          ? "Could not reach the server. Check your connection and try again."
          : "Something went wrong. Please try again.");
  }
}

/** True when the failure was a dropped connection rather than a server reply. */
export function isNetworkError(err: unknown): boolean {
  const apiError = err as ApiError;
  return apiError?.status == null && /failed to fetch|networkerror|load failed/i.test(apiError?.message || "");
}

/** True when the session is gone and the user must sign in again. */
export function isUnauthorized(err: unknown): boolean {
  return (err as ApiError)?.status === 401;
}
