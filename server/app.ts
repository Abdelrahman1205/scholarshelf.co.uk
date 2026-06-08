import "dotenv/config";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
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

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
    activeContext: string | null;
    schoolId: string | null;
    /** Support mode: owner enters a school context for troubleshooting */
    supportSchoolId: string | null;
    supportSchoolName: string | null;
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

async function ensureBootstrapSchema() {
  if (!RESOLVED_DATABASE_URL) return;

  const pool = new Pool({
    connectionString: RESOLVED_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
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

  if (process.env.NODE_ENV === "production") {
    // Required on Vercel so secure cookies are issued behind the edge proxy.
    app.set("trust proxy", 1);
  }

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), { maxAge: "1d" }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
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
          ssl: { rejectUnauthorized: false },
        }),
        tableName: "user_sessions",
        createTableIfMissing: true,
      })
    : new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "edubook-session-secret-dev",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite.js");
      await setupVite(httpServer, app);
    }
  }

  return { app, httpServer };
}
