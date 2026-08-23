/**
 * script/smoke-boot.ts
 *
 * The test that would have caught all three production outages.
 *
 * Every deploy of this project has been the first clean-checkout compile of the
 * artefact that actually ships. `npm run build` bundles server/index.ts into
 * dist/index.cjs, but vercel.json's outputDirectory is dist/public — the server
 * bundle is never uploaded, and production instead runs api/index.ts, which
 * Vercel compiles independently at deploy time. So a committed file importing an
 * uncommitted one built fine locally and died on Vercel.
 *
 * This script closes that gap in two steps:
 *
 *   1. COMPILE api/index.ts — the real entry point — with everything bundled
 *      except runtime dependencies. Anything that cannot be resolved (a file
 *      that was never committed, a package missing from package.json) fails
 *      here, at build time, instead of at the first request in production.
 *
 *   2. BOOT it under production-shaped environment variables and issue one real
 *      request to /api/health. This catches the PAYMENT_WEBHOOK_SECRET class of
 *      failure: config that is fine in development and throws at module load in
 *      production, before any route is reached, producing a 100% 500 rate.
 *
 * Runs in a few seconds, needs no database, and is safe in CI.
 */
import { build as esbuild } from "esbuild";
import { readFile, mkdir, rm } from "fs/promises";
import { spawn } from "child_process";
import path from "path";

const OUT_DIR = path.resolve("dist/smoke");
const OUT_FILE = path.join(OUT_DIR, "api.cjs");
const PORT = 5199;

/**
 * Production-shaped, but deliberately database-free. DATABASE_URL is absent, so
 * the app falls back to in-memory sessions — fine for a boot check, and it keeps
 * this runnable on any machine and in CI with no services.
 */
const BOOT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "production",
  SESSION_SECRET: "smoke-boot-session-secret-thirty-two-characters-min",
  PAYMENT_WEBHOOK_SECRET: "smoke-boot-webhook-secret",
  // A syntactically valid URL pointing at nothing. Production refuses to start
  // without DATABASE_URL — correctly — and pg connects lazily, so this satisfies
  // the startup assertion without needing a database anywhere near CI.
  DATABASE_URL: "postgres://smoke:smoke@127.0.0.1:59999/smoke",
  CONSOLE_RO_DATABASE_URL: undefined,
  CONSOLE_RW_DATABASE_URL: undefined,
  RESEND_API_KEY: undefined,
  RESEND_FROM_EMAIL: undefined,
  PORT: String(PORT),
};

function fail(step: string, detail: string): never {
  console.error(`\n✗ smoke-boot failed at: ${step}\n`);
  console.error(detail.trimEnd());
  console.error("");
  process.exit(1);
}

async function compile(): Promise<void> {
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));

  // Runtime dependencies stay external — they are installed in production.
  // EVERYTHING else, including anything nobody remembered to declare, gets
  // bundled, so a missing package fails this build instead of the first request.
  //
  // ./vite.js is the one deliberate exception. server/app.ts reaches it through
  // a dynamic import that only runs when NODE_ENV !== "production", so bundling
  // it would drag the whole dev toolchain (vite, babel, lightningcss) into a
  // check of code production never executes.
  const externals = [...Object.keys(pkg.dependencies || {}), "./vite.js"];

  await rm(OUT_DIR, { recursive: true, force: true }).catch(() => {});
  await mkdir(OUT_DIR, { recursive: true });

  try {
    await esbuild({
      entryPoints: ["api/index.ts"],
      platform: "node",
      target: "node20",
      bundle: true,
      format: "cjs",
      outfile: OUT_FILE,
      external: externals,
      logLevel: "silent",
    });
  } catch (err: any) {
    fail(
      "compiling api/index.ts",
      [
        "An import could not be resolved. This is the exact failure mode that has",
        "reached production three times: a committed file importing a file that was",
        "never committed, or a package the server imports that is not in",
        "package.json's dependencies.",
        "",
        String(err?.message ?? err),
      ].join("\n"),
    );
  }
}

/** Boot the compiled handler in a child process and hit /api/health. */
async function boot(): Promise<void> {
  const runner = `
    const http = require("http");
    const mod = require(${JSON.stringify(OUT_FILE)});
    const handler = mod.default || mod;
    const server = http.createServer((req, res) => handler(req, res));
    server.listen(${PORT}, "127.0.0.1", () => process.send && process.send("listening"));
    server.on("error", (e) => { console.error("listen failed:", e.message); process.exit(1); });
  `;

  const child = spawn(process.execPath, ["-e", runner], {
    env: BOOT_ENV,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });

  const listening = new Promise<void>((resolve, reject) => {
    child.on("message", (m) => m === "listening" && resolve());
    child.on("exit", (code) =>
      reject(new Error(`the server exited with code ${code} before it finished starting`)),
    );
    setTimeout(() => reject(new Error("the server did not start within 20s")), 20_000);
  });

  try {
    await listening;
  } catch (err: any) {
    child.kill();
    fail(
      "booting api/index.ts under production env",
      [
        "The app threw during module load or startup with NODE_ENV=production.",
        "In production this is a 100% 500 rate on every route, usually caused by a",
        "required environment variable that is optional in development.",
        "",
        String(err?.message ?? err),
        stderr || stdout,
      ].join("\n"),
    );
  }

  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    const body = await res.text();
    if (!res.ok) {
      fail(
        "GET /api/health",
        `Expected 200, got ${res.status}.\n\n${body}\n\n${stderr}`,
      );
    }
    console.log(`  health check: ${res.status} ${body.slice(0, 120)}`);
  } catch (err: any) {
    fail("GET /api/health", `${String(err?.message ?? err)}\n\n${stderr || stdout}`);
  } finally {
    child.kill();
  }
}

async function main() {
  console.log("smoke-boot: compiling api/index.ts (the artefact Vercel actually runs)...");
  await compile();
  console.log("  compiled cleanly — every import resolves");

  console.log("smoke-boot: booting under production-shaped env...");
  await boot();

  console.log("\n✓ smoke-boot passed — clean checkout compiles, boots and serves /api/health\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
