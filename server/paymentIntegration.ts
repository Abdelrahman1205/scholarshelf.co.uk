/**
 * EduBook External Payment Integration Layer
 *
 * This file is the single plug-in point for the external school management
 * system's payment API. When the other company provides their API credentials
 * and endpoint details, only this file needs to be updated.
 *
 * The integration supports two flows:
 * 1. PUSH: EduBook calls the external API when a payment is initiated.
 * 2. PULL (Webhook): The external system calls POST /api/webhooks/payment-update
 *    to notify EduBook that a payment has been confirmed or rejected.
 *
 * For AntiGravity Integration Team:
 * - Replace EXTERNAL_API_BASE_URL and EXTERNAL_API_KEY with your values (set in environment).
 * - Implement the createExternalPayment() function body to call your API.
 * - The webhook secret (WEBHOOK_SECRET) should be set as an env variable for HMAC verification.
 */

// ── Security: use ESM import, never require() ──────────────────────────────
import crypto from "crypto";

const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_PAYMENT_API_URL || "";
const EXTERNAL_API_KEY = process.env.EXTERNAL_PAYMENT_API_KEY || "";
export const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "";

// ── Startup assertion ──────────────────────────────────────────────────────
// In production, a missing webhook secret means every webhook call is accepted
// without verification — a critical payment-manipulation vulnerability.
if (process.env.NODE_ENV === "production" && !WEBHOOK_SECRET) {
  throw new Error(
    "[SECURITY] PAYMENT_WEBHOOK_SECRET must be set in production. " +
    "Without it, any unauthenticated request can confirm or cancel payments. " +
    "Generate a secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

export const isExternalIntegrationEnabled = (): boolean => {
  return !!(EXTERNAL_API_BASE_URL && EXTERNAL_API_KEY);
};

export interface ExternalPaymentRequest {
  eduBookReference: string;
  studentName: string;
  studentClass: string;
  parentEmail: string;
  amountGBP: number;
  items: { title: string; quantity: number; unitPrice: number }[];
}

export interface ExternalPaymentResponse {
  externalPaymentId: string;
  externalStatus: "pending" | "completed" | "failed";
  redirectUrl?: string;
  message?: string;
}

export interface ExternalWebhookPayload {
  externalPaymentId: string;
  eduBookReference: string;
  status: "completed" | "failed" | "pending";
  confirmedAt?: string;
  notes?: string;
}

/**
 * Called when a parent initiates a payment in EduBook.
 * Replace the body of this function with the actual API call once credentials are provided.
 */
export async function createExternalPayment(
  request: ExternalPaymentRequest,
): Promise<ExternalPaymentResponse | null> {
  if (!isExternalIntegrationEnabled()) {
    return null;
  }

  try {
    const response = await fetch(`${EXTERNAL_API_BASE_URL}/payments/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${EXTERNAL_API_KEY}`,
        "X-EduBook-Reference": request.eduBookReference,
      },
      body: JSON.stringify({
        reference: request.eduBookReference,
        student_name: request.studentName,
        student_class: request.studentClass,
        parent_email: request.parentEmail,
        amount: request.amountGBP,
        currency: "GBP",
        items: request.items.map((i) => ({
          description: i.title,
          quantity: i.quantity,
          unit_price: i.unitPrice,
        })),
      }),
    });

    if (!response.ok) {
      console.error(`[PaymentIntegration] External API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return {
      externalPaymentId: data.payment_id || data.id,
      externalStatus: data.status || "pending",
      redirectUrl: data.redirect_url,
      message: data.message,
    };
  } catch (err) {
    console.error("[PaymentIntegration] Failed to call external API:", err);
    return null;
  }
}

/** How far out of date a webhook timestamp may be before it is rejected. */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

export type WebhookVerification =
  | { ok: true }
  | { ok: false; status: number; reason: string };

/**
 * Verify an incoming webhook delivery: signature, freshness, and the presence of
 * an event id the caller can then use for replay protection.
 *
 * WHAT CHANGED, AND WHY
 *
 * The signature used to be computed over `JSON.stringify(req.body)` — the body
 * re-serialised by this process, not the bytes the sender signed. Key order and
 * whitespace differ between serialisers, so that check was simultaneously
 * fragile and weaker than it looked. It now runs over the raw request bytes.
 *
 * The signed value is `<timestamp>.<raw body>`, so the timestamp cannot be
 * altered without invalidating the signature, and a delivery older than the
 * tolerance window is refused. That closes the replay window to five minutes;
 * the event id closes it entirely, and the caller is responsible for claiming it
 * exactly once before doing any work.
 */
export function verifyWebhookRequest(params: {
  rawBody: string;
  signature: string;
  timestamp: string;
  eventId: string;
}): WebhookVerification {
  const { rawBody, signature, timestamp, eventId } = params;

  if (!signature) return { ok: false, status: 401, reason: "Missing X-Signature." };
  if (!timestamp)  return { ok: false, status: 400, reason: "Missing X-Timestamp." };
  if (!eventId)    return { ok: false, status: 400, reason: "Missing X-Event-Id." };

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, status: 400, reason: "X-Timestamp must be Unix seconds." };
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - sentAt);
  if (ageSeconds > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, status: 400, reason: "Webhook timestamp is outside the accepted window." };
  }

  if (!verifyWebhookSignature(`${timestamp}.${rawBody}`, signature)) {
    return { ok: false, status: 401, reason: "Invalid webhook signature." };
  }

  return { ok: true };
}

/**
 * Verifies the HMAC-SHA256 signature on incoming webhook calls.
 *
 * SECURITY: Fails CLOSED — returns false if the secret is not configured rather
 * than accepting all traffic. In production the startup assertion above ensures
 * the secret is always set, so this branch is a defence-in-depth safety net.
 */
export function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
): boolean {
  // Fail closed: no secret → reject all webhook calls.
  if (!WEBHOOK_SECRET) {
    console.error("[PaymentIntegration][SECURITY] PAYMENT_WEBHOOK_SECRET is not set — rejecting webhook.");
    return false;
  }
  try {
    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    const received = receivedSignature.replace(/^sha256=/i, "");
    // timingSafeEqual requires equal-length buffers.
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(received, "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
