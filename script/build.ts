import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir } from "fs/promises";

/**
 * Which packages stay OUT of the server bundle.
 *
 * This used to be an allowlist of things to bundle, with everything else marked
 * external — and esbuild never resolves an external import, so a package missing
 * from the list produced a GREEN build with no warning and a crash at require()
 * on the first request. The list was wrong in both directions: ten entries were
 * not dependencies at all, and five packages the server imports were missing.
 *
 * Inverted, the default is safe. Runtime dependencies stay external because they
 * are installed in production; everything else — including anything nobody
 * remembered to declare — gets bundled, so a missing package fails the BUILD.
 *
 * ./vite.js is the one deliberate exception: server/app.ts reaches it through a
 * dynamic import that only runs outside production, and bundling it would drag
 * the entire dev toolchain into the production artefact.
 */
const DEV_ONLY_MODULES = ["./vite.js"];

async function buildAll() {
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
  const externals = [...Object.keys(pkg.dependencies || {}), ...DEV_ONLY_MODULES];

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
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
