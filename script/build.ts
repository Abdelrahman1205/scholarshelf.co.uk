import "dotenv/config";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir } from "fs/promises";
import { spawnSync } from "child_process";

const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "@neondatabase/serverless",
  "bcryptjs",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

/**
 * Refuse to build shipping code against a database that has not had its
 * migrations applied.
 *
 * "Database migrations completely omitted from deploy pipeline" is a Critical
 * finding in the Legal & Compliance directive under Deployment & CI/CD. The
 * failure mode is quiet and nasty: new code deploys, the schema it expects is
 * not there, and the first person to notice is a school.
 *
 * The gate runs only when DATABASE_URL is set — a local `npm run build` with no
 * database configured is unaffected. If this fails your deploy, that is the gate
 * doing its job: run `npm run db:migrate` against that database first.
 */
function assertMigrationsApplied() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("[build] DATABASE_URL not set — skipping the migration check.");
    return;
  }
  console.log("[build] checking that database migrations are applied…");
  const result = spawnSync("npx", ["tsx", "script/migrate.ts", "status"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(
      "\n[build] Refusing to build: the database is missing migrations this code expects.\n" +
      "        Run `npm run db:migrate` against it, then build again.\n",
    );
    process.exit(1);
  }
}

async function buildAll() {
  assertMigrationsApplied();

  // Skip rm if filesystem doesn't support unlink; ensure dist exists
  try {
    await rm("dist", { recursive: true, force: true });
  } catch (_) {
    // mounted fs may not support unlink — continue with overwrite
  }
  await mkdir("dist", { recursive: true }).catch(() => {});

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    // server/vite.ts is development-only. Keep its dynamic import external so
    // Vite and vite.config.ts are not bundled into the production server.
    external: [...externals, "./vite.js"],
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
