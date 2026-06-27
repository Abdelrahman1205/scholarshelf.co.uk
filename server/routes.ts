/**
 * server/routes.ts — thin re-export shim.
 *
 * The actual route registration logic lives in server/routes/index.ts,
 * split into domain-specific files under server/routes/.
 *
 * This file exists so server/app.ts continues to import from "./routes.js"
 * without modification.
 */
export { registerRoutes } from "./routes/index.js";
