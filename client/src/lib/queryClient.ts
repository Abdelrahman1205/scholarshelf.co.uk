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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
