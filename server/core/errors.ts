/**
 * server/core/errors.ts
 *
 * Application error hierarchy — pure domain logic, zero external deps.
 *
 * Rule: throw a typed AppError from services/repositories and let the
 * Express error handler in app.ts convert it to the right HTTP status.
 * Routes should never construct raw Error() objects.
 */

// ── Base ───────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // distinguish from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── 400 ───────────────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;
  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
    this.fields = fields;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, "BAD_REQUEST");
  }
}

// ── 401 ───────────────────────────────────────────────────────────────────

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHENTICATED");
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid username or password") {
    super(message, 401, "INVALID_CREDENTIALS");
  }
}

// ── 403 ───────────────────────────────────────────────────────────────────

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

export class AccountSuspendedError extends AppError {
  constructor(message = "Account is suspended") {
    super(message, 403, "ACCOUNT_SUSPENDED");
  }
}

// ── 404 ───────────────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} '${id}' not found` : `${resource} not found`, 404, "NOT_FOUND");
  }
}

// ── 409 ───────────────────────────────────────────────────────────────────

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

// ── 429 ───────────────────────────────────────────────────────────────────

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMITED");
  }
}

// ── 500 ───────────────────────────────────────────────────────────────────

export class DatabaseError extends AppError {
  constructor(message = "A database error occurred") {
    super(message, 500, "DATABASE_ERROR");
  }
}

// ── Guard ─────────────────────────────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
