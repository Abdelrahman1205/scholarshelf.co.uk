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

const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_PAYMENT_API_URL || "";
const EXTERNAL_API_KEY = process.env.EXTERNAL_PAYMENT_API_KEY || "";
export const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "";

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
  request: ExternalPaymentRequest
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

/**
 * Verifies the HMAC signature on incoming webhook calls from the external system.
 * The external system must sign the payload with the shared WEBHOOK_SECRET.
 */
export function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string
): boolean {
  if (!WEBHOOK_SECRET) return true;
  try {
    const crypto = require("crypto");
    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSignature.replace("sha256=", ""), "hex")
    );
  } catch {
    return false;
  }
}
