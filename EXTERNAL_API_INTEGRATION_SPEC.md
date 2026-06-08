# EduBook ↔ External School Management System
## API Integration Specification

**Document version**: 1.0  
**Prepared for**: AntiGravity Development Team  
**EduBook contact**: School Administrator  

---

## 1. Overview

EduBook is ready to integrate with your school management system's payment API. The integration uses two flows:

| Flow | Direction | When |
|------|-----------|------|
| **PUSH** | EduBook → Your API | When a parent initiates a payment in EduBook |
| **PULL (Webhook)** | Your API → EduBook | When you confirm or reject a payment in your system |

Both flows are optional and independent. EduBook continues to function with manual admin confirmation if the integration is not active.

---

## 2. Setup: Environment Variables

Add these to the EduBook server environment:

| Variable | Required | Description |
|----------|----------|-------------|
| `EXTERNAL_PAYMENT_API_URL` | Yes | Base URL of your payment API (e.g. `https://api.yourschoolsystem.com/v1`) |
| `EXTERNAL_PAYMENT_API_KEY` | Yes | Bearer token / API key for authentication |
| `PAYMENT_WEBHOOK_SECRET` | Optional | Shared HMAC-SHA256 secret for webhook signature verification |

Once `EXTERNAL_PAYMENT_API_URL` and `EXTERNAL_PAYMENT_API_KEY` are set, the integration is activated automatically.

---

## 3. Flow A: EduBook Calls Your API (PUSH)

When a parent clicks "I've Made the Transfer" in EduBook, the system calls:

```
POST {EXTERNAL_PAYMENT_API_URL}/payments/create
Authorization: Bearer {EXTERNAL_PAYMENT_API_KEY}
Content-Type: application/json
X-EduBook-Reference: EDU-XXXXXX-XXXX
```

**Request Body:**
```json
{
  "reference": "EDU-XXXXXX-XXXX",
  "student_name": "Liam Taylor",
  "student_class": "Year 4",
  "parent_email": "parent@example.com",
  "amount": 47.50,
  "currency": "GBP",
  "items": [
    {
      "description": "English Year 4 Workbook",
      "quantity": 1,
      "unit_price": 12.50
    },
    {
      "description": "Maths Textbook",
      "quantity": 1,
      "unit_price": 35.00
    }
  ]
}
```

**Expected Response (200 OK):**
```json
{
  "payment_id": "EXT-TXN-98765",
  "status": "pending",
  "redirect_url": "https://yourschoolsystem.com/pay/EXT-TXN-98765",
  "message": "Payment initiated"
}
```

EduBook will store the `payment_id` as `externalPaymentId` against the payment record.

---

## 4. Flow B: Your System Calls EduBook (Webhook/PULL)

When your system processes the payment, call this endpoint on EduBook:

```
POST https://{edubook-domain}/api/webhooks/payment-update
Content-Type: application/json
X-Signature: sha256={HMAC_SHA256_OF_BODY}
```

**Request Body:**
```json
{
  "externalPaymentId": "EXT-TXN-98765",
  "eduBookReference": "EDU-XXXXXX-XXXX",
  "status": "completed",
  "confirmedAt": "2026-05-02T14:30:00Z",
  "notes": "Bank transfer verified by staff"
}
```

**Status values:**
| Value | Effect in EduBook |
|-------|-------------------|
| `completed` | Auto-confirms the payment; books are allocated to the student |
| `failed` | Auto-rejects the payment; basket is returned to pending |
| `pending` | Updates external status only; no action taken |

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment EDU-XXXXXX-XXXX updated to status: completed"
}
```

---

## 5. Webhook Signature Verification (Optional but Recommended)

EduBook verifies the `X-Signature` header using HMAC-SHA256.

**To sign your webhook call:**
```
signature = HMAC-SHA256(body_as_json_string, PAYMENT_WEBHOOK_SECRET)
X-Signature: sha256={signature_hex}
```

If `PAYMENT_WEBHOOK_SECRET` is not set in EduBook's environment, signature verification is skipped.

---

## 6. Data Schema Reference

**EduBook Payment Record fields relevant to integration:**

| Field | Type | Description |
|-------|------|-------------|
| `paymentReference` | string | EduBook-generated unique reference (e.g. `EDU-XXXXXX-XXXX`) |
| `externalPaymentId` | string | ID from your system (set after PUSH or PULL) |
| `externalPaymentStatus` | string | Latest status from your system |
| `status` | string | EduBook internal status: `pending`, `completed`, `failed` |
| `totalAmount` | decimal | Amount in GBP |
| `parentIdentifier` | string | Parent email address |
| `paidAt` | timestamp | When the payment was initiated in EduBook |
| `confirmedAt` | timestamp | When the payment was confirmed (manual or auto) |
| `notes` | string | Optional notes from your system |

---

## 7. Check Integration Status

Admins can verify the integration is active by calling:

```
GET /api/admin/integration-status
Authorization: (session cookie)
```

**Response:**
```json
{
  "externalPaymentIntegration": true,
  "webhookEndpoint": "/api/webhooks/payment-update",
  "webhookSignatureHeader": "X-Signature"
}
```

---

## 8. Integration File Location

All integration logic is contained in a single file:

```
server/paymentIntegration.ts
```

This is the only file that needs to be modified if the external API structure changes.
