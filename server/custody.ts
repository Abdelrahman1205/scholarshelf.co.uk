/**
 * server/custody.ts — book-custody state machine (Slice 4)
 *
 * One custody unit = one allocation (student × book). The custody status makes
 * "who physically has this book" explicit instead of inferring it from
 * status/distributionStatus/payment. Transitions are validated against a strict
 * allowed-transitions map; every applied transition is appended to custody_events
 * by storage.recordCustodyTransition().
 *
 * Happy path:  reserved → prepared → handed_to_teacher → issued → collected
 * Exceptions:  absent (redelivery) | returned | damaged | lost
 *
 * This module is pure (no DB) so the rules are unit-testable in isolation.
 */

export const CUSTODY_STATES = [
  "reserved",
  "prepared",
  "handed_to_teacher",
  "issued",
  "collected",
  // exceptions
  "absent",
  "returned",
  "damaged",
  "lost",
] as const;

export type CustodyStatus = (typeof CUSTODY_STATES)[number];

export const HAPPY_PATH: CustodyStatus[] = [
  "reserved",
  "prepared",
  "handed_to_teacher",
  "issued",
  "collected",
];

export const EXCEPTION_STATES: CustodyStatus[] = ["absent", "returned", "damaged", "lost"];

/**
 * Allowed transitions. Strict: a transition not listed here is rejected.
 * The map reflects the real workflow — including legitimate shortcuts (a school
 * may prepare then issue directly without a separate teacher-hand-off step) —
 * while blocking nonsensical jumps (e.g. collected → reserved).
 */
export const ALLOWED_TRANSITIONS: Record<CustodyStatus, CustodyStatus[]> = {
  reserved: ["prepared", "returned", "lost"],
  prepared: ["handed_to_teacher", "issued", "returned", "lost", "damaged"],
  handed_to_teacher: ["issued", "absent", "returned", "lost", "damaged"],
  issued: ["collected", "returned", "lost", "damaged"],
  collected: ["returned", "lost", "damaged"], // post-collection problems can still be recorded
  // Exception states and their recoveries
  absent: ["handed_to_teacher", "issued", "returned", "lost"], // redelivery or give up
  returned: ["reserved", "prepared"], // book went back to stock, can re-enter the flow
  damaged: ["returned", "prepared"], // replaced/restocked
  lost: ["returned", "prepared"], // found/replaced
};

export function isValidCustodyStatus(s: string): s is CustodyStatus {
  return (CUSTODY_STATES as readonly string[]).includes(s);
}

export function isTransitionAllowed(from: CustodyStatus, to: CustodyStatus): boolean {
  if (from === to) return true; // idempotent no-op is always "allowed" (handled as no change)
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Thrown when a transition is not permitted; callers map this to HTTP 409. */
export class CustodyTransitionError extends Error {
  from: CustodyStatus;
  to: string;
  constructor(from: CustodyStatus, to: string) {
    super(`Illegal custody transition: ${from} → ${to}`);
    this.name = "CustodyTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Derive a starting custody status for an EXISTING allocation from its legacy
 * fields, so the backfill maps live data onto the new model without guessing.
 */
export function deriveCustodyFromLegacy(a: {
  status?: string | null;
  distributionStatus?: string | null;
}): CustodyStatus {
  const dist = (a.distributionStatus ?? "").toLowerCase();
  const status = (a.status ?? "").toLowerCase();

  if (dist === "received") return "issued";
  if (dist === "absent") return "absent";
  if (dist === "out_of_stock") return "prepared";
  if (status === "collected") return "collected";
  if (status === "ready_for_collection" || status === "prepared") return "prepared";
  // default: allocation exists but not yet distributed
  return "reserved";
}
