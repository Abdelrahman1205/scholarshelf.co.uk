#!/usr/bin/env python3
"""
apply-live-safety.py — LIVE_SAFETY_PASS.md items 1.1 … 1.4

RUN FROM THE REPOSITORY ROOT, on a hotfix branch cut from the line that
actually builds — cut it DIRECTLY from the tag, in ONE command, so a dirty
tree or a failed checkout cannot silently leave you on some other branch:

    git checkout -b hotfix/live-safety pre-target-extraction-2026-09
    python apply-live-safety.py
    npm run check
    npm run build

(PowerShell 5.1 does not accept `&&`; run each command on its own line.)

THE GUARD CHECKS THE BASE COMMIT, NOT THE BRANCH NAME
    An earlier version rejected only `main` by name.  That let it run on
    hotfix/live-safety at 7751871 — a branch carrying nine rebuild commits,
    which is not deployable as a hotfix.  It now verifies HEAD IS the
    deployable base commit and that every file it edits is byte-identical
    to that commit's version.  --allow-descendant overrides the first check
    and prints every extra commit; there is no override for the second.

WHY THIS BASE AND NOT main
    main (e80aad8) DOES NOT TYPECHECK.  server/config/env.ts on main has no
    CONSOLE_RO_DATABASE_URL / CONSOLE_RW_DATABASE_URL, which server/config/
    consoleDb.ts requires — six TS2339 errors, none of them related to this
    hotfix.  The env fix arrived in 978c887, which is NOT on main.

    restructure/aug-2026 == tag pre-target-extraction-2026-09 == 416e4bd is
    the line MP-B01 proved typechecks, builds and boots.

    >>> CONFIRM IN VERCEL WHICH COMMIT PRODUCTION ACTUALLY SERVES BEFORE
    >>> DEPLOYING ANYTHING.  See the note at the end of this file.

The script is IDEMPOTENT: run it twice and the second run reports
"already applied" for every item and changes nothing.
"""
import re
import subprocess
import sys

FIXED = []
SKIPPED = []
STAGED = {}          # path -> new content. NOTHING is written until every fix succeeds.

# The one line that is proven to typecheck, build and boot (MP-B01).
# tag pre-target-extraction-2026-09 == restructure/aug-2026 == 416e4bd
BASE_COMMIT = "416e4bd"
BASE_TAG = "pre-target-extraction-2026-09"

# Every file this script edits. The guard checks each one is byte-identical
# to its blob at BASE_COMMIT, so a tree that has drifted is caught by CONTENT
# and not merely by branch name.
TOUCHED = (
    "server/routes/index.ts",
    "server/routes/auth.routes.ts",
    "server/console/operations.ts",
    "server/routes/mfa.routes.ts",
    "server/routes/db-console.routes.ts",
    "client/src/pages/admin/db-console.tsx",
)


def read(p):
    if p in STAGED:
        return STAGED[p]
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    STAGED[p] = s     # staged, not written


def flush():
    for p, s in STAGED.items():
        with open(p, "w", encoding="utf-8", newline="") as f:
            f.write(s)
    return len(STAGED)


def bail(msg):
    print(f"\n  ABORTED: {msg}\n  NOTHING WAS WRITTEN — every edit is staged in memory\n"
          f"  and discarded together, so the tree is exactly as you left it.")
    sys.exit(1)


# ---------------------------------------------------------------- 1.1
def fix_seed_route():
    p = "server/routes/index.ts"
    body = read(p)
    if "/api/seed-users" not in body:
        SKIPPED.append("1.1 seed route (already removed)")
        return
    L = body.split("\n")
    # 1-indexed 81..244 on 416e4bd -> 0-indexed 80..243
    if not (L[80].strip() == "// === SEED DATA (development only) ==="
            and L[81].strip() == 'if (process.env.NODE_ENV !== "production") {'
            and L[82].strip().startswith('app.post("/api/seed-users"')
            and L[242].strip() == "});"
            and L[243].strip() == "}"):
        bail("1.1: server/routes/index.ts does not match the expected shape. "
             "You are probably on the wrong base commit. Expected 416e4bd.")
    del L[80:244]
    body = "\n".join(L)
    # drop imports the seed block was the only consumer of
    for imp, tok in (
        ('import bcrypt from "bcryptjs";', "bcrypt"),
        ('import { storage, getStorageMode } from "../storage.js";', "storage"),
    ):
        if imp in body:
            without = body.replace(imp, "")
            if not re.search(r"\b" + tok + r"\b", without):
                body = without
    body = re.sub(r"\n{4,}", "\n\n\n", body)
    write(p, body)
    FIXED.append("1.1 POST /api/seed-users REMOVED  (CRITICAL — unauthenticated, "
                 "created bythub/bythub123 platform-owner and five more)")


# ---------------------------------------------------------------- 1.2a
def fix_auth_reset_log():
    p = "server/routes/auth.routes.ts"
    body = read(p)
    old = "        console.log(`[PASSWORD RESET] Link for ${email}: ${resetLink}`);\n"
    if old not in body:
        SKIPPED.append("1.2a auth reset-link log (already removed)")
        return
    new = (
        "        // SEC-R001: NEVER log the link or the token. A reset link in a log\n"
        "        // is an account-takeover primitive. Record that delivery failed,\n"
        "        // and nothing that could be used to complete the reset.\n"
        '        console.error("[PASSWORD RESET] delivery failed; reset link NOT logged");\n'
    )
    write(p, body.replace(old, new, 1))
    FIXED.append("1.2a auth.routes.ts no longer logs the reset link  (CRITICAL — SEC-R001)")


# ---------------------------------------------------------------- 1.2b
def fix_console_reset_log():
    p = "server/console/operations.ts"
    body = read(p)
    old = ('      console.warn("[console] Resend not configured; reset link logged instead.");\n'
           "      console.log(`[PASSWORD RESET] ${user.email}: ${resetLink}`);\n")
    if old not in body:
        SKIPPED.append("1.2b console reset-link log (already removed)")
        return
    new = ("      // SEC-R001: the link is NEVER logged, configured or not.\n"
           '      console.warn("[console] Resend not configured; reset e-mail was not delivered.");\n')
    write(p, body.replace(old, new, 1))
    FIXED.append("1.2b console/operations.ts no longer logs the reset link  (CRITICAL — SEC-R001)")


# ---------------------------------------------------------------- 1.3
def fix_mfa_enrolment():
    p = "server/routes/mfa.routes.ts"
    body = read(p)
    if "C-90 / SECAR-011" in body:
        SKIPPED.append("1.3 MFA enrolment password check (already applied)")
        return
    old = ("      const secret = req.session.pendingMfaSetupSecret;\n"
           '      if (!secret) return res.status(400).json({ message: "Start setup first, then enter a code." });\n'
           "\n"
           '      const token = String(req.body?.token || "").trim();\n')
    if body.count(old) != 1:
        bail("1.3: could not find exactly one MFA enrolment block in mfa.routes.ts.")
    new = (
        "      // C-90 / SECAR-011: enrolment BINDS AN AUTHENTICATOR to this account,\n"
        "      // so it requires the CURRENT PASSWORD — exactly as /mfa/disable and\n"
        "      // /mfa/recovery-codes already do in this same file. Without it a\n"
        "      // hijacked session can bind an attacker's authenticator and lock the\n"
        "      // real account holder out of their own account.\n"
        '      const password = String(req.body?.password || "");\n'
        "      if (!(await bcrypt.compare(password, user.passwordHash))) {\n"
        '        return res.status(401).json({ message: "Incorrect password." });\n'
        "      }\n"
        "\n"
    ) + old
    write(p, body.replace(old, new, 1))
    FIXED.append("1.3 MFA enrolment now requires the current password  (CRITICAL — C-90)")


# ---------------------------------------------------------------- 1.4a
def fix_sql_route():
    p = "server/routes/db-console.routes.ts"
    body = read(p)
    if "/api/owner/db/query" not in body:
        SKIPPED.append("1.4a arbitrary-SQL route (already removed)")
        return
    L = body.split("\n")
    # 1-indexed 187..232 on 416e4bd -> 0-indexed 186..231
    if not (L[186].strip().startswith('app.post("/api/owner/db/query"')
            and L[231].strip() == "});"):
        bail("1.4a: db-console.routes.ts does not match the expected shape. "
             "Wrong base commit? Expected 416e4bd.")
    del L[186:232]
    body = re.sub(r"\n{4,}", "\n\n\n", "\n".join(L))
    write(p, body)
    FIXED.append("1.4a POST /api/owner/db/query REMOVED  (HIGH — unbounded SQL over "
                 "every tenant's children's records)")


# ---------------------------------------------------------------- 1.4b
def fix_sql_client():
    p = "client/src/pages/admin/db-console.tsx"
    body = read(p)
    if "/api/owner/db/query" not in body:
        SKIPPED.append("1.4b SQL console caller (already removed)")
        return
    old = """    setIsRunning(true); setError(null); setRequiresConfirm(false);
    try {
      // The console connects as console_ro inside BEGIN READ ONLY and always
      // rolls back, so there is no such thing as a "dangerous" query here any
      // more \u2014 Postgres refuses writes before this code ever sees them.
      const r = await apiRequest("POST", "/api/owner/db/query", { query });
      const data = await r.json();
      if (!r.ok) {
        setError(data.message || "Query failed");
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setIsRunning(false);
    }"""
    if body.count(old) != 1:
        bail("1.4b: could not find exactly one runQuery body in db-console.tsx.")
    new = """    // The arbitrary-SQL endpoint has been WITHDRAWN. It was an unbounded
    // read/write primitive over every tenant's children's records, and the
    // locked target does not contain it (Stage 12 s26). Schema and table
    // browsing above are unaffected; a bounded investigation surface
    // (API-271 / API-272) replaces this at MP-B28.
    setIsRunning(false);
    setRequiresConfirm(false);
    setResult(null);
    setError(
      "The SQL console has been withdrawn. Use the schema and table views above. " +
      "A bounded investigation surface replaces it.",
    );"""
    write(p, body.replace(old, new, 1))
    FIXED.append("1.4b client no longer calls the SQL endpoint")


# ---------------------------------------------------------------- verify
def verify():
    print("\n  VERIFICATION")
    ok = True
    checks = [
        ("no seed route registered",
         "/api/seed-users", ["server/routes/index.ts"]),
        ("no arbitrary-SQL route",
         "/api/owner/db/query", ["server/routes/db-console.routes.ts",
                                 "client/src/pages/admin/db-console.tsx"]),
    ]
    for label, needle, paths in checks:
        hit = [p for p in paths if needle in read(p)]
        print(f"    [{'ok ' if not hit else 'FAIL'}] {label}"
              + (f"  -> still in {hit}" if hit else ""))
        ok &= not hit

    logs = []
    for p in ("server/routes/auth.routes.ts", "server/console/operations.ts"):
        for line in read(p).split("\n"):
            if "PASSWORD RESET" in line and "resetLink" in line:
                logs.append((p, line.strip()))
    print(f"    [{'ok ' if not logs else 'FAIL'}] no reset link reaches a log"
          + (f"  -> {logs}" if logs else ""))
    ok &= not logs

    mfa = read("server/routes/mfa.routes.ts")
    has = "C-90 / SECAR-011" in mfa
    print(f"    [{'ok ' if has else 'FAIL'}] MFA enrolment requires the current password")
    ok &= has
    return ok


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def check_base(allow_descendant=False):
    """Verify the BASE COMMIT, not the branch name.

    The previous version of this guard rejected only 'main' and 'master' by
    NAME.  That is not the property that matters and it let this script run
    happily on 7751871 — a branch that carried nine rebuild commits and was
    therefore not deployable as a hotfix at all.  The check is now:

      1  HEAD must BE the deployable base (or, with --allow-descendant, a
         descendant of it — and then every extra commit is listed, because
         a hotfix that ships rebuild commits is not a hotfix)
      2  every file this script edits must be byte-identical to its blob at
         the base, so a drifted tree is caught by CONTENT as well
    """
    try:
        head_full = git("rev-parse", "HEAD")
        head = git("rev-parse", "--short", "HEAD")
        branch = git("rev-parse", "--abbrev-ref", "HEAD")
    except Exception:
        bail("this is not a git repository, or git is not on PATH. "
             "Run the script from the repository root.")

    print(f"  repository at {branch} ({head})")

    # resolve the base: prefer the tag, fall back to the literal commit
    base_full = None
    for ref in (BASE_TAG, BASE_COMMIT, "restructure/aug-2026"):
        try:
            base_full = git("rev-parse", f"{ref}^{{commit}}")
            print(f"  deployable base {ref} ({base_full[:7]})")
            break
        except Exception:
            continue
    if base_full is None:
        bail(f"cannot resolve the deployable base ({BASE_TAG} / {BASE_COMMIT}). "
             "Fetch the repository fully — a shallow clone will not do.")
    if not base_full.startswith(BASE_COMMIT):
        bail(f"the resolved base is {base_full[:7]}, expected {BASE_COMMIT}. "
             "Somebody has moved the tag or the branch. Stop and find out who.")

    if head_full != base_full:
        try:
            is_desc = subprocess.call(
                ["git", "merge-base", "--is-ancestor", base_full, head_full]) == 0
        except Exception:
            is_desc = False
        if not is_desc:
            bail(f"HEAD ({head}) is NOT the deployable base and does not even "
                 f"descend from it.\n  main (e80aad8) DOES NOT TYPECHECK; the "
                 f"rebuild branch is not deployable.\n"
                 f"  Use:  git checkout -b hotfix/live-safety {BASE_TAG}")
        extra = git("log", "--oneline", f"{base_full}..{head_full}").split("\n")
        extra = [e for e in extra if e]
        if not allow_descendant:
            listing = "\n".join(f"      {e}" for e in extra[:15])
            bail(f"HEAD ({head}) carries {len(extra)} commit(s) beyond the "
                 f"deployable base {base_full[:7]}:\n{listing}\n"
                 f"  A hotfix branch must contain ONLY the hotfix. Shipping "
                 f"rebuild commits to production\n  is exactly what this guard "
                 f"exists to stop.\n"
                 f"  Cut a clean branch:  git checkout -b hotfix/live-safety "
                 f"{BASE_TAG}\n"
                 f"  If you have already reviewed every commit above and you "
                 f"mean to ship them,\n  re-run with --allow-descendant.")
        print(f"  !! {len(extra)} commit(s) beyond the base, allowed explicitly:")
        for e in extra[:15]:
            print(f"       {e}")

    # content check — the property that actually matters.
    # A file is acceptable if it is byte-identical to the base, OR if THIS
    # script's own fix is already in it (the script is idempotent and must
    # stay runnable twice).
    already = {
        "server/routes/index.ts":
            lambda s: "/api/seed-users" not in s,
        "server/routes/auth.routes.ts":
            lambda s: "[PASSWORD RESET] Link for" not in s,
        "server/console/operations.ts":
            lambda s: "reset link logged instead" not in s,
        "server/routes/mfa.routes.ts":
            lambda s: "C-90 / SECAR-011" in s,
        "server/routes/db-console.routes.ts":
            lambda s: "/api/owner/db/query" not in s,
        "client/src/pages/admin/db-console.tsx":
            lambda s: "/api/owner/db/query" not in s,
    }
    drifted, applied = [], []
    for f in TOUCHED:
        try:
            at_base = git("show", f"{base_full}:{f}")
        except Exception:
            drifted.append((f, "absent at the base commit"))
            continue
        try:
            with open(f, encoding="utf-8") as fh:
                now = fh.read()
        except FileNotFoundError:
            drifted.append((f, "missing from the working tree"))
            continue
        if now.replace("\r\n", "\n").rstrip("\n") == at_base.rstrip("\n"):
            continue
        if already[f](now):
            applied.append(f)
        else:
            drifted.append((f, "modified, and NOT by this script"))
    if applied:
        print(f"  ({len(applied)} file(s) already carry this script's fix)")
    if drifted:
        listing = "\n".join(f"      {f}  — {why}" for f, why in drifted)
        bail("these files are neither the base version nor a version this "
             f"script produced:\n{listing}\n  Somebody else has edited them, "
             "or the base is wrong. Read `git diff` before\n  editing "
             "production code — do not let this script overwrite work you "
             "cannot see.")


if __name__ == "__main__":
    check_base(allow_descendant="--allow-descendant" in sys.argv)

    fix_seed_route()
    fix_auth_reset_log()
    fix_console_reset_log()
    fix_mfa_enrolment()
    fix_sql_route()
    fix_sql_client()

    print("\n  APPLIED")
    for f in FIXED:
        print(f"    + {f}")
    if not FIXED:
        print("    (nothing — everything was already applied)")
    if SKIPPED:
        print("\n  ALREADY APPLIED")
        for s in SKIPPED:
            print(f"    · {s}")

    n = flush()
    print(f"\n  WROTE {n} file(s).")

    good = verify()

    print("""
  NEXT
    npm run check          expect 0 errors on this base
    npm run build
    npm run test:security  the suite that covers these paths

  THEN, AND THIS IS NOT OPTIONAL — LIVE_SAFETY_PASS.md s3:
    · invalidate every outstanding password-reset token.  Any link already
      written to a log is a LIVE CREDENTIAL until it expires
    · establish who has had access to production logs, and for how long
    · audit the users table for: bythub, admin, teacher, teacher2, parent,
      it_admin, finance.  Any that exists and was not created by you is a
      COMPROMISE, not a curiosity
    · whether this is reportable is for BytHub Legal & Compliance.  It is
      not an engineering judgement and must not be decided in the repo

  BEFORE DEPLOYING
    Confirm in the Vercel dashboard WHICH COMMIT production serves.  main
    does not typecheck, so it is probably not main — and if nobody can say
    what is running, that is its own finding for a system holding
    children's data.
""")
    sys.exit(0 if good else 1)
