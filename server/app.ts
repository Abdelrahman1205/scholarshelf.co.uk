import "dotenv/config";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { createServer, type Server } from "http";
import path from "path";
import { randomUUID } from "crypto";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
// SECURITY: one implementation only. app.ts previously carried its own copy with
// no DATABASE_SSL_STRICT escape hatch, which meant the SESSION store could never
// be hardened even when the flag was set. Both pools now share this one.
import { buildSslConfig } from "./config/database.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const FORCE_MEMORY_STORAGE =
  !IS_PRODUCTION && process.env.FORCE_MEMORY_STORAGE === "true";
const RESOLVED_DATABASE_URL = FORCE_MEMORY_STORAGE
  ? ""
  : (process.env.DATABASE_URL?.trim() ?? "");

// ── Security startup assertions ────────────────────────────────────────────
// Fail fast in production if required secrets are missing.
if (IS_PRODUCTION) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "[SECURITY] SESSION_SECRET must be set to a cryptographically random " +
      "string of at least 32 characters in production. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
    activeContext: string | null;
    schoolId: string | null;
    /** Support mode: owner enters a school context for troubleshooting */
    supportSchoolId: string | null;
    supportSchoolName: string | null;
    /**
     * Whether this user has MFA enrolled, stamped at login so guards can check
     * it without a database round-trip on every request. Kept in sync wherever
     * MFA is enabled or disabled.
     */
    mfaEnabled?: boolean;
    /**
     * Cached for the console audit trail, so an entry reads "who" without a
     * lookup. A UUID in an audit log is not an answer to "who did this?".
     */
    username?: string;
    /**
     * Break-glass write access to the BytHub console. Granted only by a fresh
     * TOTP code plus a written reason, and expires on its own. Absent or expired
     * means the console is read-only, which is its normal state.
     */
    consoleElevation?: {
      id: string;
      expiresAt: number;
      reason: string;
    } | null;
    /**
     * Partial-auth marker set after a correct password when the account has MFA
     * enabled. The user is NOT authenticated (no userId) until they pass the
     * TOTP/recovery challenge at /api/auth/mfa/verify.
     */
    pendingMfa?: {
      userId: string;
      expiresAt: number;
    } | null;
    /** Secret generated during MFA enrolment, held server-side until the user confirms a code. */
    pendingMfaSetupSecret?: string | null;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

type CreateAppOptions = {
  serverless?: boolean;
};

// ── Role-based session lifetimes ───────────────────────────────────────────
// Privileged roles get shorter sessions. Parents/teachers get the full window.
const SESSION_MAX_AGE: Record<string, number> = {
  owner:         8  * 60 * 60 * 1000, //  8 hours
  platform_admin: 8  * 60 * 60 * 1000, //  8 hours
  school_admin:  8  * 60 * 60 * 1000, //  8 hours
  admin:         8  * 60 * 60 * 1000, //  8 hours
  finance:       8  * 60 * 60 * 1000, //  8 hours
  it_personnel:  8  * 60 * 60 * 1000, //  8 hours
  teacher:       24 * 60 * 60 * 1000, // 24 hours
  parent:        30 * 24 * 60 * 60 * 1000, // 30 days
};
const DEFAULT_SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours fallback

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp(options: CreateAppOptions = {}): Promise<{ app: Express; httpServer: Server }> {
  const app = express();
  const httpServer = createServer(app);

  if (IS_PRODUCTION) {
    // Required on Vercel so secure cookies are issued behind the edge proxy.
    app.set("trust proxy", 1);
  }

  // ── Security headers ─────────────────────────────────────────────────────
  // helmet() sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy,
  // X-XSS-Protection, and more in a single call.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // 'unsafe-eval' is only needed for the Vite dev HMR runtime; it must NOT
          // be present in production, where it materially weakens XSS defence.
          scriptSrc: IS_PRODUCTION
            ? ["'self'", "'unsafe-inline'"]
            : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
        },
      },
      // HSTS: only enforce in production (avoids issues on localhost)
      strictTransportSecurity: IS_PRODUCTION
        ? { maxAge: 63072000, includeSubDomains: true }
        : false,
    }),
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), { maxAge: "1d" }));

  // ── Request logging ────────────────────────────────────────────────────────
  // SECURITY: Log only method, path, status, and duration.
  // Never log response bodies — they contain PII, tokens, and reset links.
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;

    res.on("finish", () => {
      if (reqPath.startsWith("/api")) {
        const duration = Date.now() - start;
        log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  });

  const MemoryStore = createMemoryStore(session);
  const PgSession = connectPgSimple(session);

  const sessionStore: session.Store = RESOLVED_DATABASE_URL
    ? new PgSession({
        pool: new Pool({
          connectionString: RESOLVED_DATABASE_URL,
          ssl: buildSslConfig(),
        }),
        tableName: "user_sessions",
        createTableIfMissing: true,
      })
    : new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });

  // ── Session secret ────────────────────────────────────────────────────────
  // No fallback — if SESSION_SECRET is absent in production the startup
  // assertion above already throws. In development a warning is logged.
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.warn(
      "[SECURITY WARNING] SESSION_SECRET is not set. " +
      "Using a deterministic fallback is ONLY acceptable in local development. " +
      "Set SESSION_SECRET in production or sessions can be forged.",
    );
  }

  app.use(
    session({
      store: sessionStore,
      // Throw in production (startup assertion above), warn + fallback in dev.
      secret: sessionSecret || "edubook-session-secret-dev-only-never-use-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        // Default lifetime — overridden per-role after login in auth routes.
        maxAge: DEFAULT_SESSION_MAX_AGE,
        httpOnly: true,
        secure: IS_PRODUCTION,
        // 'strict' prevents the session cookie from being sent on any cross-site
        // request, hardening CSRF defence on state-changing routes. Top-level
        // navigations into the SPA still authenticate normally.
        sameSite: "strict",
      },
    }),
  );

  // Slice 6: global write rate-limit. A generous per-identity cap on mutating
  // /api requests blunts abuse and runaway clients without touching read traffic.
  // Endpoints with their own (stricter) limiters — auth, cron, link-code — are
  // exempt so we never double-limit them. The limiter must never itself block
  // traffic if the backing store errors.
  const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const RL_EXEMPT = [/^\/api\/auth\//, /^\/api\/cron\//, /^\/api\/parent\/link-/];
  app.use(async (req, res, next) => {
    if (!req.path.startsWith("/api/") || !WRITE_METHODS.has(req.method)) return next();
    if (RL_EXEMPT.some((re) => re.test(req.path))) return next();
    try {
      const { rateLimit, clientIp } = await import("./middleware/auth.js");
      // Prefer the session identity; fall back to the proxy-resolved IP. Never
      // x-forwarded-for directly — the leftmost entry is client-controlled.
      const id = (req.session as any)?.userId || clientIp(req);
      if (await rateLimit(`mutations:${id}`, 240, 60_000)) {
        return res.status(429).json({
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly.", details: null },
          message: "Too many requests. Please slow down and try again shortly.",
        });
      }
    } catch { /* never block traffic on limiter failure */ }
    next();
  });

  // ensureBootstrapSchema() used to run here — roughly 30 ALTER TABLE / CREATE
  // TABLE statements fired at production Postgres on EVERY serverless cold start,
  // with every failure swallowed by `catch { console.warn }`.
  //
  // Three problems, now gone: it added a stack of sequential round-trips to every
  // cold start; ALTER TABLE takes an ACCESS EXCLUSIVE lock, so concurrent cold
  // starts on a busy morning contended on students/families/schools; and a column
  // that failed to add did not stop startup, it surfaced later as a query error
  // nobody could explain.
  //
  // Every table it created is declared in shared/schema.ts, so this was pure
  // duplication. Schema changes now go through `npm run db:push` (or, better, a
  // reviewed migration) as a deliberate deploy step rather than a side effect of
  // someone loading a page.

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    if (res.headersSent) {
      return next(err);
    }

    if (status >= 500) {
      // SECURITY: never return err.message on a 5xx. Postgres errors carry table,
      // column and constraint names — and occasionally row values — straight to
      // the client. Log the detail against a correlation id and return only the id,
      // so support can still trace it without leaking the schema.
      const errorId = randomUUID();
      console.error(`[error ${errorId}]`, err);
      return res.status(status).json({
        message: "Something went wrong on our end. Quote this reference if you contact support.",
        errorId,
      });
    }

    // 4xx messages are written by us and are safe to surface.
    return res.status(status).json({ message: err.message || "Request failed" });
  });

  if (!options.serverless) {
    if (IS_PRODUCTION) {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite.js");
      await setupVite(httpServer, app);
    }
  }

  return { app, httpServer };
}

// ── Exported session lifetime helper ──────────────────────────────────────
// Called by auth routes after login to stamp the correct maxAge on the cookie.
export function getSessionMaxAge(role: string): number {
  return SESSION_MAX_AGE[role] ?? DEFAULT_SESSION_MAX_AGE;
}
