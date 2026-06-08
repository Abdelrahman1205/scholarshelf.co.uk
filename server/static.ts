import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In the production CJS bundle (dist/index.cjs), process.argv[1] points to
  // the entry script so its directory == dist/.  Fall back to process.cwd()
  // for environments that mangle argv (e.g. some Vercel edge runtimes).
  const base = process.argv[1] ? path.dirname(process.argv[1]) : process.cwd();
  const distPath = path.resolve(base, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
