import "dotenv/config";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { createServer, type Server } from "http";
import path from "path";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";

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

// ── SSL helper ─────────────────────────────────────────────────────────────
// Prefer strict certificate validation. Fall back to permissive only when
// DATABASE_SSL_CA is absent AND we are NOT in production.
function buildSslConfig(): object {
  const ca = process.env.DATABASE_SSL_CA;
  if (ca) return { rejectUnauthorized: true, ca };
  if (IS_PRODUCTION) {
    // Warn but do not fail — Neon typically uses a trusted CA already.
    // Set DATABASE_SSL_CA in Vercel env vars for full verification.
    console.warn(
      "[SECURITY WARNING] DATABASE_SSL_CA is not set. SSL certificate " +
      "verification is disabled for the database connection. " +
      "Set DATABASE_SSL_CA to the Neon CA certificate for full MitM protection.",
    );
  }
  return { rejectUnauthorized: false };
}

async function ensureBootstrapSchema() {
  if (!RESOLVED_DATABASE_URL) return;

  const pool = new Pool({
    connectionString: RESOLVED_DATABASE_URL,
    ssl: buildSslConfig(),
  });

  try {
    await pool.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_status text NOT NULL DEFAULT 'pending_admin_invite'`);
    await pool.query(`UPDATE schools SET setup_status = CASE WHEN status = 'active' THEN 'active' ELSE 'pending_admin_invite' END WHERE setup_status IS NULL OR setup_status = ''`);
    await pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS invitee_name text`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id varchar(36) PRIMARY KEY,
        user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission text NOT NULL,
        created_at timestamp DEFAULT now(),
        UNIQUE (user_id, permission)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS user_permissions_user_id_idx ON user_permissions(user_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_branding (
        id varchar(36) PRIMARY KEY,
        school_id varchar(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        logo_url text,
        logo_file_id text,
        favicon_url text,
        favicon_file_id text,
        banner_image_url text,
        banner_file_id text,
        email_header_logo_url text,
        email_header_logo_file_id text,
        pdf_logo_url text,
        pdf_logo_file_id text,
        primary_colour text DEFAULT '#2563EB',
        secondary_colour text DEFAULT '#1E3A8A',
        accent_colour text DEFAULT '#0EA5E9',
        theme_name text DEFAULT 'default',
        font_preference text DEFAULT 'Inter',
        setup_status text DEFAULT 'pending',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        updated_by varchar(36) REFERENCES users(id),
        UNIQUE (school_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS school_branding_school_id_idx ON school_branding(school_id)`);
    // Student soft-delete columns
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at timestamp`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_by varchar(36)`);
    // Family-first enrollment columns (additive only)
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS family_id varchar(36)`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth text`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS grade_level text`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS preferred_reading_level text`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url text`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS family_code text`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS household_name text`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS primary_contact_guardian_id varchar(36)`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS primary_phone text`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS primary_email text`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS address text`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'enrolled'`);
    await pool.query(`ALTER TABLE families ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS families_family_code_key ON families(family_code)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guardians (
        id varchar(36) PRIMARY KEY,
        school_id varchar(36),
        family_id varchar(36) NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        full_name text NOT NULL,
        relationship text,
        email text,
        phone text,
        is_primary_contact boolean NOT NULL DEFAULT false,
        portal_access_status text NOT NULL DEFAULT 'none',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS guardians_family_id_idx ON guardians(family_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS guardians_school_id_idx ON guardians(school_id)`);
    // teacher_profiles table (used by getUserWithDetail and getTeacherProfile)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teacher_profiles (
        id varchar(36) PRIMARY KEY,
        user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school_id varchar(36) NOT NULL,
        department text,
        subjects text,
        created_at timestamp DEFAULT now(),
        created_by_admin_id varchar(36),
        UNIQUE (user_id, school_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS teacher_profiles_user_id_idx ON teacher_profiles(user_id)`);
  } catch (error) {
    console.warn("Schema bootstrap warning:", error);
  } finally {
    await pool.end().catch(() => {});
  }
}

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

  await ensureBootstrapSchema();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
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
