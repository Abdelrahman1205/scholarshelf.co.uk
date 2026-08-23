/**
 * client/src/components/query-state.tsx
 *
 * THE PROBLEM THIS SOLVES
 *
 * Of 111 client files, five handled query errors — four of them owner-facing.
 * There were ZERO error branches in the parent, teacher, finance or school-admin
 * pages. Combined with `retry: false`, one dropped request on school wifi is
 * final, and the page renders its empty state as if it were fact:
 *
 *   finance.tsx   a failed summary renders "Total Revenue £0.00 · Outstanding
 *                 £0.00". A bursar could reasonably conclude nobody has paid.
 *   parent.tsx    a failed request tells a parent "No baskets awaiting payment.
 *                 You're all caught up." — when they may owe money and have a
 *                 deadline.
 *
 * A blank screen is honest. A confident zero is not. That is the whole point of
 * this component: when we do not know, say so, and offer the retry.
 *
 * Usage:
 *
 *   const q = useQuery({ queryKey: ["/api/finance/summary"] });
 *   return (
 *     <QueryState query={q} label="the finance summary">
 *       {(data) => <Dashboard summary={data} />}
 *     </QueryState>
 *   );
 */
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeApiError, isNetworkError, isUnauthorized } from "@/lib/errors";

interface QueryStateProps<T> {
  query: Pick<UseQueryResult<T>, "data" | "isLoading" | "isError" | "error" | "refetch" | "isFetching">;
  /** Named in the messages: "Could not load <label>." Use a noun phrase. */
  label: string;
  /** Rendered on success. Given the data, which is guaranteed non-undefined. */
  children: (data: T) => React.ReactNode;
  /** Override the loading state (a skeleton usually reads better than text). */
  loading?: React.ReactNode;
  /** Render errors inline (a card in a grid) rather than as a full block. */
  compact?: boolean;
}

export function QueryState<T>({ query, label, children, loading, compact }: QueryStateProps<T>) {
  if (query.isLoading) {
    return <>{loading ?? <QueryLoading label={label} compact={compact} />}</>;
  }

  if (query.isError) {
    return <QueryError error={query.error} label={label} onRetry={() => query.refetch()} retrying={query.isFetching} compact={compact} />;
  }

  // A successful query with no data is a real empty state — the caller's
  // children decide how to render it.
  return <>{children(query.data as T)}</>;
}

function QueryLoading({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div
      className={compact ? "p-4 text-sm text-muted-foreground" : "flex items-center justify-center py-20 text-muted-foreground"}
      role="status"
      aria-live="polite"
    >
      Loading {label}…
    </div>
  );
}

export function QueryError({
  error, label, onRetry, retrying, compact,
}: {
  error: unknown;
  label: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const offline = isNetworkError(error);
  const expired = isUnauthorized(error);

  const heading = expired
    ? "Your session has expired"
    : offline
      ? `Could not reach the server`
      : `Could not load ${label}`;

  const detail = expired
    ? "Sign in again to carry on. Nothing you were looking at has changed."
    : offline
      ? `We could not load ${label} because the connection dropped. This is not a sign that there is nothing to show.`
      : describeApiError(error, { fallback: `Something went wrong loading ${label}.` });

  const Icon = offline ? WifiOff : AlertCircle;

  return (
    <div
      role="alert"
      className={
        compact
          ? "rounded-xl border border-destructive/30 bg-destructive/5 p-4"
          : "rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
      }
    >
      <div className={compact ? "flex items-start gap-3" : "flex flex-col items-center gap-2"}>
        <Icon className={compact ? "h-4 w-4 mt-0.5 text-destructive shrink-0" : "h-6 w-6 text-destructive"} />
        <div className={compact ? "min-w-0" : ""}>
          <p className="text-sm font-semibold text-foreground">{heading}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          {expired ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { window.location.href = "/login"; }}>
              Sign in again
            </Button>
          ) : onRetry ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry} disabled={retrying}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Try again"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
