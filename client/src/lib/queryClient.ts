import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Default to raw status + body; try to extract a clean message from JSON
    let message = `${res.status}: ${text}`;
    let parsed: any = null;
    try {
      const body = JSON.parse(text);
      parsed = body;
      if (res.status === 403 && body.schoolStatus) {
        window.__schoolBlockedMessage = body.message || "Your school account is currently inactive.";
      }
      if (body.message) {
        message = body.message;
      }
    } catch {}
    // Attach status + parsed body so callers can react to structured responses
    // (e.g. the Slice-3 "link vs create" 409 with existingUserId/suggestedAction).
    const err = new Error(message) as Error & { status?: number; body?: any };
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
}

// Global for passing school-blocked message to login page
declare global {
  interface Window {
    __schoolBlockedMessage?: string;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * A dead session must not leave the user inside a fully-rendered app showing
 * zeros.
 *
 * Every query throws on 401, each page falls back to [] or a zero, and nothing
 * redirects — so with staleTime on /api/auth/me the user could sit in an app
 * that looked fine, and quietly wrong, for minutes after their session died.
 * One handler, in one place: the moment any query comes back 401, send them to
 * sign in.
 *
 * Guarded so it fires once per session death rather than once per query — a
 * dashboard fires a dozen queries and they will all 401 together.
 */
let redirectingToLogin = false;

function handleUnauthorized(): void {
  if (redirectingToLogin) return;
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  // Already on an unauthenticated page — nothing to redirect away from.
  if (["/login", "/register", "/forgot-password", "/reset-password", "/accept-invite"].some((p) => path.startsWith(p))) return;
  redirectingToLogin = true;
  queryClient.clear();
  window.location.href = `/login?next=${encodeURIComponent(path + window.location.search)}`;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      // Retry is deliberately off for correctness-sensitive data, but that makes
      // a single dropped request final — which is why every consumer needs a
      // visible error state (see components/query-state.tsx) rather than an
      // empty one. A single retry on a network-level failure is safe: it means
      // the request never reached the server.
      retry: (failureCount, error: any) => failureCount < 1 && error?.status == null,
    },
    mutations: {
      retry: false,
    },
  },
});

queryClient.getQueryCache().subscribe((event: any) => {
  if (event?.query?.state?.status === "error" && event.query.state.error?.status === 401) {
    handleUnauthorized();
  }
});
