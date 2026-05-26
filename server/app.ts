import "dotenv/config";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
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
  if (!process.env.DATABASE_URL) return;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_status text NOT NULL DEFAULT 'pending_admin_invite'`);
    await pool.query(`UPDATE schools SET setup_status = CASE WHEN status = 'active' THEN 'active' ELSE 'pending_admin_invite' END WHERE setup_status IS NULL OR setup_status = ''`);
    await pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS invitee_name text`);
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

  const sessionStore: session.Store = process.env.DATABASE_URL
    ? new PgSession({
        pool: new Pool({
          connectionString: process.env.DATABASE_URL,
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