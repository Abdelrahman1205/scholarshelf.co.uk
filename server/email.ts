import { Resend } from "resend";

// Support both RESEND_API_KEY (existing) and EMAIL_API_KEY (spec alias)
const resendApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;

// Support both RESEND_FROM_EMAIL (existing) and EMAIL_FROM (spec alias)
const resendFrom =
  process.env.RESEND_FROM_EMAIL ||
  process.env.EMAIL_FROM ||
  "Scholar Shelf <noreply@scholarshelf.co.uk>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type EmailBranding = {
  schoolName?: string | null;
  logoUrl?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
};

export function isResendConfigured(): boolean {
  return !!resend;
}

// ---------------------------------------------------------------------------
// Internal helper — all emails go through here
// ---------------------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.warn("[Scholar Shelf Email] Resend not configured — no email sent.");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[Scholar Shelf Email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Scholar Shelf Email] Failed to send email:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared HTML wrapper — consistent Scholar Shelf styling
// ---------------------------------------------------------------------------
function wrapEmail(title: string, body: string, branding?: EmailBranding): string {
  const brandPrimary = branding?.primaryColour || "#1e3a5f";
  const brandSecondary = branding?.secondaryColour || "#0f172a";
  const heading = branding?.schoolName || "Scholar Shelf";
  const logoUrl = branding?.logoUrl || null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="background:${brandPrimary};padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">
                      ${heading}
                    </span>
                  </td>
                  ${logoUrl ? `<td align="right" style="vertical-align:middle;"><img src="${logoUrl}" alt="${heading} logo" style="max-height:42px;max-width:150px;display:block;background:#ffffff;border-radius:6px;padding:4px;" /></td>` : ""}
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f5;padding:20px 32px;text-align:center;
                        font-size:12px;color:#6b7280;">
              &copy; ${new Date().getFullYear()} Scholar Shelf &mdash; scholarshelf.co.uk<br/>
              This email was sent automatically. Please do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <div style="height:4px;background:${brandSecondary};"></div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Password Reset
// ---------------------------------------------------------------------------
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Reset your password</h2>
    <p>We received a request to reset the password for your Scholar Shelf account.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${resetLink}"
         style="background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#4b5563;font-size:13px;">${resetLink}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This link expires in <strong>1 hour</strong>. If you did not request a
      password reset, you can safely ignore this email.
    </p>
  `;

  return sendEmail(to, "Reset your Scholar Shelf password", wrapEmail("Reset your password", body, branding));
}

// ---------------------------------------------------------------------------
// 2. Staff / Admin Invite
// ---------------------------------------------------------------------------
export async function sendInviteEmail(
  to: string,
  role: string,
  inviteLink: string,
  branding?: EmailBranding
): Promise<boolean> {
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">You've been invited to Scholar Shelf</h2>
    <p>You have been invited to join Scholar Shelf as a <strong>${roleLabel}</strong>.</p>
    <p>Click the button below to set up your account:</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${inviteLink}"
         style="background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Accept Invitation
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#4b5563;font-size:13px;">${inviteLink}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This invitation expires in <strong>7 days</strong>.
    </p>
  `;

  return sendEmail(to, "Your Scholar Shelf invitation", wrapEmail("You've been invited", body, branding));
}

// ---------------------------------------------------------------------------
// 2b. School setup invite for first School Admin
// ---------------------------------------------------------------------------
export async function sendSchoolSetupInviteEmail(
  to: string,
  adminName: string,
  schoolName: string,
  inviteLink: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Complete your EduBook school setup</h2>
    <p>Hello ${adminName},</p>
    <p><strong>${schoolName}</strong> has been created in EduBook and you have been invited as the first School Admin.</p>
    <p>Use the secure link below to create your password, accept the invitation, and continue the school setup.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${inviteLink}"
         style="background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Continue School Setup
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#4b5563;font-size:13px;">${inviteLink}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This setup invitation expires in <strong>7 days</strong> and can only be used once.
    </p>
  `;

  return sendEmail(
    to,
    `Complete your EduBook school setup for ${schoolName}`,
    wrapEmail("Complete your school setup", body, {
      schoolName,
      logoUrl: branding?.logoUrl || null,
      primaryColour: branding?.primaryColour || null,
      secondaryColour: branding?.secondaryColour || null,
    })
  );
}

// ---------------------------------------------------------------------------
// 3. Parent Linking Code
// ---------------------------------------------------------------------------
export async function sendParentCodeEmail(
  to: string,
  studentName: string,
  linkingCode: string,
  expiresAt: Date,
  branding?: EmailBranding
): Promise<boolean> {
  const expiryStr = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Your child's book linking code</h2>
    <p>A linking code has been generated for <strong>${studentName}</strong>.</p>
    <p>Use this code to link your parent account to your child's book record on Scholar Shelf:</p>
    <p style="text-align:center;margin:28px 0;">
      <span style="background:#f0f4ff;border:2px solid #1e3a5f;border-radius:8px;
                   padding:14px 32px;font-size:28px;font-weight:bold;letter-spacing:4px;
                   color:#1e3a5f;display:inline-block;">
        ${linkingCode}
      </span>
    </p>
    <p><strong>How to use it:</strong></p>
    <ol style="padding-left:20px;color:#374151;">
      <li>Sign in to Scholar Shelf at <a href="https://scholarshelf.co.uk">scholarshelf.co.uk</a></li>
      <li>Go to <strong>My Children</strong> and click <strong>Link a Child</strong></li>
      <li>Enter the code above</li>
    </ol>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This code expires on <strong>${expiryStr}</strong> and can only be used once.
      If you did not expect this email, please contact your school.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Linking code for ${studentName}`,
    wrapEmail("Your child's linking code", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 4. Payment Submitted (confirmation to parent)
// ---------------------------------------------------------------------------
export async function sendPaymentSubmittedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  paymentMethod: string,
  branding?: EmailBranding
): Promise<boolean> {
  const methodLabel = paymentMethod.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Payment received — under review</h2>
    <p>Thank you! We have received your payment submission for Scholar Shelf books.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Method</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;">${methodLabel}</td>
      </tr>
    </table>
    <p>Your school will review and confirm the payment. You will receive another email once it has been verified.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Please keep your reference number for your records. If you have any questions,
      contact your school directly.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Payment submitted (Ref: ${paymentReference})`,
    wrapEmail("Payment submitted", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 5. Payment Verified (admin confirms → email parent)
// ---------------------------------------------------------------------------
export async function sendPaymentVerifiedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Your payment has been verified ✓</h2>
    <p>Great news — your Scholar Shelf payment has been confirmed by your school.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Status</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">Verified</td>
      </tr>
    </table>
    <p>Your child's books will be prepared for distribution. You may receive further communication from your school regarding collection.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Thank you for using Scholar Shelf.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Payment verified (Ref: ${paymentReference})`,
    wrapEmail("Payment verified", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 6. Payment Rejected (admin rejects → email parent)
// ---------------------------------------------------------------------------
export async function sendPaymentRejectedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Payment could not be verified</h2>
    <p>Unfortunately your Scholar Shelf payment could not be verified by your school.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Status</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">Rejected</td>
      </tr>
    </table>
    <p>Please contact your school directly for more information and to arrange an alternative payment.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      We apologise for any inconvenience. If you believe this is an error,
      please reach out to your school.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Payment could not be verified (Ref: ${paymentReference})`,
    wrapEmail("Payment rejected", body, branding)
  );
}
