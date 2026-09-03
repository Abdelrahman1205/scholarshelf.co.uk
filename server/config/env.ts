/**
 * server/config/env.ts
 *
 * Single source of truth for all environment variables.
 *
 * Validated at startup with Zod — the app throws immediately on missing
 * required config rather than failing silently mid-request.
 * Import `env` instead of `process.env.*` throughout the server.
 */
import { z } from "zod";

const IS_PROD = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ── Database ───────────────────────────────────────────────────────────
  DATABASE_URL:     z.string().url().optional(),
  DATABASE_SSL_CA:  z.string().optional(),

  // Least-privilege connection strings for the BytHub console. Both are
  // optional: without CONSOLE_RO_DATABASE_URL the console reports itself as
  // unconfigured rather than falling back to the main (owner-privileged)
  // credentials, and without CONSOLE_RW_DATABASE_URL break-glass writes are
  // simply unavailable. See migrations/001_console_hardening.sql.
  CONSOLE_RO_DATABASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  CONSOLE_RW_DATABASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),

  // ── Session ────────────────────────────────────────────────────────────
  SESSION_SECRET: IS_PROD
    ? z.string().min(32, "SESSION_SECRET must be ≥ 32 chars in production")
    : z.string().optional().default("edubook-dev-secret-not-for-production"),

  // ── Server ────────────────────────────────────────────────────────────
  PORT:         z.coerce.number().int().positive().default(5000),
  APP_BASE_URL: z.string().url().optional(),

  // ── Email ─────────────────────────────────────────────────────────────
  RESEND_API_KEY:    z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  RESEND_FROM_EMAIL: z.preprocess((v) => (v === "" ? undefined : v), z.string().email().optional()),

  // ── Payment integration ───────────────────────────────────────────────
  EXTERNAL_PAYMENT_API_URL:  z.string().url().optional(),
  EXTERNAL_PAYMENT_API_KEY:  z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: IS_PROD
    ? z.string().min(16, "PAYMENT_WEBHOOK_SECRET must be set in production")
    : z.string().optional().default(""),

  // ── Dev toggles ───────────────────────────────────────────────────────
  ALLOW_MEMORY_STORAGE: z.enum(["true", "false"]).optional().default("false"),
  FORCE_MEMORY_STORAGE: z.enum(["true", "false"]).optional().default("false"),
});

type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`[ENV] Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

export const env: Env = parseEnv();
export const IS_PRODUCTION = env.NODE_ENV === "production";
