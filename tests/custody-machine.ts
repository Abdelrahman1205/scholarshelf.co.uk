/**
 * tests/custody-machine.ts — Slice 4: pure unit tests for the custody state machine.
 *
 * No server required — imports the rules directly, so it's deterministic and not
 * affected by rate limits or DB state.
 *
 * Run: npm run test:custody
 */
import {
  CUSTODY_STATES, ALLOWED_TRANSITIONS, isValidCustodyStatus,
  isTransitionAllowed, deriveCustodyFromLegacy, type CustodyStatus,
} from "../server/custody.js";

const results: { name: string; passed: boolean; detail: string }[] = [];
const ok = (name: string, detail = "") => { results.push({ name, passed: true, detail }); console.log(`  ✓ ${name}${detail ? " — " + detail : ""}`); };
const no = (name: string, detail: string) => { results.push({ name, passed: false, detail }); console.log(`  ✗ ${name} — ${detail}`); };
const expect = (cond: boolean, name: string, detail = "") => cond ? ok(name, detail) : no(name, detail || "assertion failed");

console.log("═══════════════════════════════════════════════");
console.log("  Custody State Machine — Slice 4 Unit Tests");
console.log("═══════════════════════════════════════════════\n");

console.log("─── Happy path allowed ───");
const happy: [CustodyStatus, CustodyStatus][] = [
  ["reserved", "prepared"],
  ["prepared", "handed_to_teacher"],
  ["handed_to_teacher", "issued"],
  ["issued", "collected"],
  ["prepared", "issued"], // legitimate shortcut (no separate hand-off)
];
for (const [a, b] of happy) expect(isTransitionAllowed(a, b), `${a} → ${b} allowed`);

console.log("\n─── Illegal jumps rejected ───");
const illegal: [CustodyStatus, CustodyStatus][] = [
  ["reserved", "collected"],
  ["reserved", "issued"],
  ["collected", "reserved"],
  ["issued", "prepared"],
  ["collected", "issued"],
  ["prepared", "collected"],
];
for (const [a, b] of illegal) expect(!isTransitionAllowed(a, b), `${a} → ${b} rejected`);

console.log("\n─── Exceptions from correct states ───");
expect(isTransitionAllowed("handed_to_teacher", "absent"), "handed_to_teacher → absent");
expect(isTransitionAllowed("handed_to_teacher", "lost"), "handed_to_teacher → lost");
expect(isTransitionAllowed("issued", "damaged"), "issued → damaged");
expect(isTransitionAllowed("issued", "returned"), "issued → returned");
expect(isTransitionAllowed("absent", "handed_to_teacher"), "absent → handed_to_teacher (redelivery)");
expect(isTransitionAllowed("returned", "reserved"), "returned → reserved (restock/re-enter)");
expect(!isTransitionAllowed("reserved", "absent"), "reserved → absent rejected (nothing to be absent from)");

console.log("\n─── Idempotent same-state ───");
expect(isTransitionAllowed("issued", "issued"), "issued → issued (no-op) allowed");

console.log("\n─── Validity guard ───");
expect(isValidCustodyStatus("issued"), "'issued' is valid");
expect(!isValidCustodyStatus("teleported"), "'teleported' is invalid");
expect(CUSTODY_STATES.length === 9, "9 custody states defined", `got ${CUSTODY_STATES.length}`);

console.log("\n─── Legacy derivation (backfill mapping) ───");
expect(deriveCustodyFromLegacy({ distributionStatus: "received" }) === "issued", "received → issued");
expect(deriveCustodyFromLegacy({ distributionStatus: "absent" }) === "absent", "absent → absent");
expect(deriveCustodyFromLegacy({ distributionStatus: "out_of_stock" }) === "prepared", "out_of_stock → prepared");
expect(deriveCustodyFromLegacy({ status: "collected" }) === "collected", "status collected → collected");
expect(deriveCustodyFromLegacy({ status: "allocated" }) === "reserved", "default → reserved");

console.log("\n─── Every state has a transition entry ───");
for (const s of CUSTODY_STATES) expect(Array.isArray(ALLOWED_TRANSITIONS[s]), `${s} has transition list`);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed);
console.log("\n═══════════════════════════════════════════════");
console.log(`  Results: ${passed}/${results.length} passed`);
if (failed.length) { console.log("\n  Failures:"); failed.forEach((r) => console.log(`    ✗ ${r.name} — ${r.detail}`)); }
console.log("═══════════════════════════════════════════════\n");
process.exit(failed.length > 0 ? 1 : 0);
